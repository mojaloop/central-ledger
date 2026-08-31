/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------
 ******/

import assert from 'node:assert';
import crypto from 'node:crypto';

import { Enum, Util } from '@mojaloop/central-services-shared'
const { Kafka } = Util
const { decodePayload } = Util.StreamingProtocol

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { FSPIOPError } = ErrorHandler

import { ApplicationConfig } from '../lib/config';
import { assertNestedFields, assertOneOf } from '../lib/config/util';
import { getFxTransferDuplicateCheck, getFxTransferErrorDuplicateCheck } from '../models/fxTransfer/duplicateCheck';
import FxTransferModel, { saveFxFulfilResponse } from '../models/fxTransfer/fxTransfer';
import fspiopErrorFactory from '../shared/fspiopErrorFactory';
import { logger } from '../shared/logger';
import { TransferHelper } from './transfer-helper';
import RefactorHelper from '../shared/refactor-helper';
import { Effect } from '../messaging/message-bus';

const { Consumer, Producer } = require('@mojaloop/central-services-stream').Util

interface Dependencies {
  config: ApplicationConfig
  cyril: {
    processFxFulfilMessage: (commitRequestId: string) => Promise<true>
    processFxAbortMessage: (commitRequestId: string) => Promise<{
      positionChanges: any,
      transferStateChanges: any,
    }>
  }
  positionHandler: null | ((error: null, messages: Array<any>) => Promise<any>)
}

export type CommitForexDto = {
  conversionState: 'RECEIVED' | 'RESERVED' | 'COMMITTED',
  fulfilment: string,
  completedTimestamp: string,
} | {
  conversionState: 'ABORTED',
  // Not sure if this is here.
  completedTimestamp: string,
  errorInformation: {
    errorCode: string,
    errorDescription: string,
    extensionList?: {
      extension: Array<{
        key: string,
        value: string
      }>
    }
  }
}

type CommitForexDtoAborted = Extract<CommitForexDto, { conversionState: 'ABORTED' }>

export interface ForexFulfilHandlerInput {
  message: any;
  payload: CommitForexDto;
  headers: any;
  commitRequestId: string;
  type: string,
  action: string,
  metric: string;
  functionality: 'transfer'
  actionEnum: string;
}

export enum ForexFulfilResultType {
  /**
   * Fulfil step completed validation. Payment was either fulfilled or aborted successfully
   */
  PASS = 'PASS',

  /**
   * Duplicate payment found in a finalized state
   */
  DUPLICATE_FINAL = 'DUPLICATE_FINAL',

  /**
   * Duplicate payment found that is still being processed
   */
  DUPLICATE_NON_FINAL = 'DUPLICATE_NON_FINAL',

  /**
   * Payment failed validation.
   */
  FAIL_VALIDATION = 'FAIL_VALIDATION',

  /**
   * Catch-all Payment failed for another reason.
   */
  FAIL_OTHER = 'FAIL_OTHER',
}

export type ForexFulfilResult = {
  type: ForexFulfilResultType.PASS,
  effects: Array<Effect>
} | {
  type: ForexFulfilResultType.DUPLICATE_FINAL,
  effects: Array<Effect>
} | {
  type: ForexFulfilResultType.DUPLICATE_NON_FINAL,
  effects: Array<Effect>
  // TODO: is there a body for this?
} | {
  type: ForexFulfilResultType.FAIL_VALIDATION,
  effects: Array<Effect>
  error: typeof FSPIOPError
} | {
  type: ForexFulfilResultType.FAIL_OTHER,
  effects: Array<Effect>
  error: typeof FSPIOPError
}


export class ForexFulfilHandler {
  constructor(private deps: Dependencies) { }

  async handle(error: any, messages: any): Promise<Array<ForexFulfilResult>> {
    if (error) {
      throw error
    }

    assert(Array.isArray(messages))
    if (this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'FUSE') {
      assert(
        this.deps.positionHandler,
        'ForexFulfilHandler.deps.positionHandler not defined, positions are in `FUSE` mode.')
    }

    if (messages.length === 0) {
      logger.debug('ForexFulfilHandler.handle() - received empty batch, nothing to process');
      return []
    }

    logger.debug(`ForexFulfilHandler.handle() - processing batch of ${messages.length} messages`)
    const inputs = messages.map(message => ({
      message,
      input: this.extractMessageData(message)
    }));

    const results = await Promise.allSettled(inputs.map(async ({ input }) => this.handleOne(input)))
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.type !== ForexFulfilResultType.PASS) {
        logger.warn(`handleOne() returned non-success: \n\t${JSON.stringify(result.value)}`)
      }
      if (result.status === 'rejected') {
        logger.error(`handleOne() failed with error: \n\t${result.reason}`)
        if (result.reason.stack) logger.error(`stack\n\t${result.reason.stack}`)
      }
    })
    return results.map(result => {
      switch (result.status) {
        case 'rejected': return {
          type: ForexFulfilResultType.FAIL_OTHER,
          error: result.reason,
          effects: []
        }
        case 'fulfilled': return result.value
      }
    })
  }

  async handleOne(input: ForexFulfilHandlerInput): Promise<ForexFulfilResult> {
    const { commitRequestId, type, action } = input

    const forex = await FxTransferModel
      .getAllDetailsByCommitRequestIdForProxiedFxTransfer(commitRequestId)
    if (!forex) {
      const fspiopError = fspiopErrorFactory.fxTransferNotFound()
      await this.sendMessageNotificationError(input, fspiopError)
      const error = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)

      return {
        type: ForexFulfilResultType.FAIL_VALIDATION,
        effects: [],
        error
      }
    }

    const validateHeaders = this.validateHeaders(forex, input.headers)
    if (validateHeaders.result === 'FAIL') {
      const error = validateHeaders.error
      await FxTransferModel.saveFxFulfilResponse(
        input.commitRequestId,
        input.payload,
        'fx-abort-validation',
        error
      )
      const apiFSPIOPError = error.toApiErrorObject(this.deps.config.ERROR_HANDLING)
      await this.sendMessagePositionRollback(input, forex, apiFSPIOPError, {
        functionality: 'position',
        action: 'fx-abort'
      })

      return {
        type: ForexFulfilResultType.FAIL_VALIDATION,
        effects: [],
        error
      }
    }
    assert(validateHeaders.result === 'PASS')

    const payloadHash = TransferHelper.hashPayload(input.payload)
    if (forex.transferState === 'COMMITTED') {
      let savedFulfilHash
      try {
        savedFulfilHash = (await getFxTransferDuplicateCheck(commitRequestId)).hash
        if (savedFulfilHash === payloadHash) {
          // Safe to ignore, we saw the same fulfil message before.
          return {
            type: ForexFulfilResultType.DUPLICATE_FINAL,
            effects: [],
          }
        }

        // Modified payload.
        return {
          type: ForexFulfilResultType.FAIL_VALIDATION,
          effects: [],
          error: ErrorHandler.Factory.createInternalServerFSPIOPError(
            `detected transfer fulfil message modified for commitRequestId: ${commitRequestId}.`
          )
        }
      } catch (err) {
        const error = ErrorHandler.Factory.createInternalServerFSPIOPError(
          'found finalized fxTransfer, but no `getFxTransferDuplicateCheck`'
        )
        logger.error(error.message)
        return {
          type: ForexFulfilResultType.FAIL_OTHER,
          effects: [],
          error,
        }
      }
    }
    if (forex.transferState === 'ABORTED') {
      // Payment is finalized. Check to see if this is an exact duplicate Fulfil message, or if the
      // fulfil message was modified in some way.
      let savedHash
      try {
        savedHash = (await getFxTransferErrorDuplicateCheck(commitRequestId)).hash
        if (savedHash === payloadHash) {
          // Safe to ignore, we saw the same fulfil message before.
          return {
            type: ForexFulfilResultType.DUPLICATE_FINAL,
            effects: [],
          }
        }
        // Modified message.
        return {
          type: ForexFulfilResultType.FAIL_VALIDATION,
          effects: [],
          error: ErrorHandler.Factory.createInternalServerFSPIOPError(
            `detected transfer fulfil message modified for commitRequestId: ${commitRequestId}.`
          )
        }
      } catch (err) {
        const error = ErrorHandler.Factory.createInternalServerFSPIOPError(
          'found finalized transfer, but no `getFxTransferErrorDuplicateCheck`'
        )
        logger.error(error.message)
        return {
          type: ForexFulfilResultType.FAIL_OTHER,
          effects: [],
          error,
        }
      }
    }

    if (input.action === 'fx-abort') {
      const payload = input.payload as CommitForexDtoAborted
      const fspiopError = fspiopErrorFactory.fromErrorInformation(payload.errorInformation)
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)

      // Save.
      await FxTransferModel.saveFxFulfilResponse(
        input.commitRequestId,
        payload,
        input.action,
        apiFSPIOPError
      )

      await this.sendMessagePositionRollback(input, forex, apiFSPIOPError, {
        functionality: 'position',
        action: 'fx-abort'
      })

      return {
        type: ForexFulfilResultType.PASS,
        effects: [],
      }
    }

    assert(input.payload.conversionState === 'COMMITTED' ||
      input.payload.conversionState === 'RESERVED'
    )
    assert(input.payload.fulfilment)

    // Validate the fulfilment.
    if (!TransferHelper.fulfilmentMatchesCondition(input.payload.fulfilment, forex.ilpCondition)) {
      // Payee sent an invalid fulfilment. Need to abort the payment.
      const fspiopError = fspiopErrorFactory.fxInvalidFulfilment()
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)
      await saveFxFulfilResponse(
        commitRequestId, input.payload, 'fx-abort-validation', apiFSPIOPError
      )

      await this.sendMessagePositionRollback(input, forex, apiFSPIOPError, {
        functionality: 'position',
        action: 'fx-abort-validation'
      })

      return {
        type: ForexFulfilResultType.FAIL_VALIDATION,
        effects: [],
        error: apiFSPIOPError
      }
    }

    if (forex.transferState !== 'RESERVED' &&
      forex.transferState !== 'RESERVED_FORWARDED' &&
      forex.transferState !== 'RECEIVED_FULFIL_DEPENDENT'
    ) {
      const fspiopError = fspiopErrorFactory.fxTransferNonReservedState()
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)
      await saveFxFulfilResponse(
        commitRequestId, input.payload, 'fx-abort-validation', apiFSPIOPError
      )
      await this.sendMessagePositionRollback(input, forex, apiFSPIOPError, {
        functionality: 'position',
        action: 'fx-abort-validation'
      })

      return {
        type: ForexFulfilResultType.FAIL_VALIDATION,
        effects: [],
        error: apiFSPIOPError,
      }
    }

    if (forex.transferState === 'RESERVED_FORWARDED') {
      // Ignore the timeout, other scheme will time out the transfer.
    } else if (forex.expirationDate <= new Date(Util.Time.getUTCString(new Date()))) {
      const fspiopError = fspiopErrorFactory.fxTransferExpired()
      const apiFSPIOPError = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)
      await saveFxFulfilResponse(
        commitRequestId, input.payload, 'fx-abort-validation', apiFSPIOPError
      )
      await this.sendMessagePositionRollback(input, forex, apiFSPIOPError, {
        functionality: 'position',
        action: 'fx-abort-validation'
      })

      return {
        type: ForexFulfilResultType.FAIL_VALIDATION,
        effects: [],
        error: apiFSPIOPError,
      }
    }

    // Validations passed.    
    await saveFxFulfilResponse(commitRequestId, input.payload, action)
    await this.deps.cyril.processFxFulfilMessage(commitRequestId)
    await this.sendMessagePositionCommit(input, forex, action)
    return {
      type: ForexFulfilResultType.PASS,
      effects: [],
    }
  }

  private validateHeaders(forex: {
    counterPartyFspIsProxy: number,
    counterPartyFspName: string,
    initiatingFspIsProxy: number,
    initiatingFspName: string,
  }, headers: any): { result: 'PASS' } | { result: 'FAIL', error: any } {

    if (!forex.counterPartyFspIsProxy &&
      headers['fspiop-source'] !== forex.counterPartyFspName.toLowerCase()) {
      return {
        result: 'FAIL',
        error: fspiopErrorFactory.fxHeaderSourceValidationError()
      }
    }

    if (!forex.initiatingFspIsProxy &&
      headers['fspiop-destination'] !== forex.initiatingFspName.toLowerCase()) {
      return {
        result: 'FAIL',
        error: fspiopErrorFactory.fxHeaderDestinationValidationError()
      }
    }

    return {
      result: 'PASS'
    }
  }

  public static _hashPayload(payload: CommitForexDto) {
    const cryptoHash = crypto.createHash('sha256')
    cryptoHash.update(JSON.stringify(payload))
    const hash = cryptoHash.digest('base64url')
    assert(hash.at(-1) !== '=', 'Hash should not have trailing `=`.')

    return hash
  }

  private extractMessageData(message: any): ForexFulfilHandlerInput {
    assert(message)
    assertNestedFields(message, 'value.content.headers')
    assertNestedFields(message, 'value.metadata.event.type')
    assertNestedFields(message, 'value.metadata.event.action')
    assertNestedFields(message, 'value.content.payload')

    const payloadEncoded = message.value.content.payload
    const payload = decodePayload(payloadEncoded, {}) as unknown as CommitForexDto
    const headers = message.value.content.headers

    assertNestedFields(message, 'value.content.uriParams.id')
    const commitRequestId = message.value.content.uriParams.id
    const type = message.value.metadata.event.type
    assert(type === 'fulfil', 'message.value.metadata.event.type must be `fulfil`.')
    const action = message.value.metadata.event.action
    assertOneOf(action, ['fx-commit', 'fx-reserve', 'fx-abort'])

    return {
      message,
      payload,
      headers,
      commitRequestId,
      type: message.value.metadata.event.type,
      action,
      metric: `handler_fx_transfers_${action.toLowerCase()}`,
      functionality: Enum.Events.Event.Type.TRANSFER,
      actionEnum: this.getActionEnum(action),
    };
  }

  private getActionEnum(action: string): string {
    const actionUpper = action.toUpperCase() as keyof typeof Enum.Events.Event.Action
    return Enum.Events.Event.Action[actionUpper] || actionUpper;
  }

  private async sendMessageNotificationError(
    input: ForexFulfilHandlerInput,
    error: typeof FSPIOPError
  ): Promise<void> {
    const params = {
      message: input.message,
      kafkaTopic: input.message.topic,
      decodedPayload: input.payload,
      span: null,
      consumer: Consumer,
      producer: Producer
    }
    const eventDetail = {
      functionality: 'notification',
      action: 'fx-reserve'
    }
    await Kafka.proceed(
      this.deps.config.KAFKA_CONFIG,
      params,
      {
        consumerCommit: true,
        fspiopError: error.toApiErrorObject(this.deps.config.ERROR_HANDLING),
        eventDetail,
        fromSwitch: true,
        hubName: this.deps.config.HUB_NAME
      }
    )
  }

  private async sendMessagePositionCommit(
    input: ForexFulfilHandlerInput,
    forex: any,
    action: string,
  ): Promise<void> {
    const eventDetail = {
      functionality: 'position',
      action
    }
    const params = {
      message: input.message,
      kafkaTopic: input.message.topic,
      decodedPayload: input.payload,
      span: null,
      consumer: Consumer,
      producer: Producer
    }
    const messageKey = forex.counterPartyFspSourceParticipantCurrencyId.toString()
    switch (this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE) {
      case 'UNFUSE': {
        await Kafka.proceed(this.deps.config.KAFKA_CONFIG, params, {
          consumerCommit: true,
          eventDetail,
          messageKey,
          topicNameOverride: this.deps.config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.COMMIT
        })
        return
      }
      case 'FUSE':
        assert(this.deps.positionHandler)
        const wrapped = RefactorHelper.wrapForPositionHandler(params, {
          eventDetail,
          messageKey,
        })

        await this.deps.positionHandler(null, [wrapped])
    }
  }

  private async sendMessagePositionRollback(
    input: ForexFulfilHandlerInput,
    forex: any,
    error: {
      errorInformation: {
        errorCode: string,
        errorDescription: string,
      }
    },
    eventDetail: {
      functionality: string,
      action: string
    }
  ): Promise<void> {
    const cyrilResult = await this.deps.cyril.processFxAbortMessage(input.commitRequestId)
    assert(cyrilResult.positionChanges.length > 0, 'Invalid cyril result.')

    const params = {
      message: input.message,
      kafkaTopic: input.message.topic,
      decodedPayload: input.payload,
      span: null,
      consumer: Consumer,
      producer: Producer
    }
    params.message.value.content.context = {
      ...params.message.value.content.context,
      cyrilResult
    }
    const participantCurrencyId = cyrilResult.positionChanges[0].participantCurrencyId
    const messageKey = participantCurrencyId.toString()

    switch (this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE) {
      case 'UNFUSE': {
        await Kafka.proceed(this.deps.config.KAFKA_CONFIG, params, {
          consumerCommit: true,
          fspiopError: error,
          eventDetail,
          fromSwitch: true,
          toDestination: forex.externalInitiatingFspName || forex.initiatingFspName,
          messageKey,
          topicNameOverride: this.deps.config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.FX_ABORT,
          hubName: this.deps.config.HUB_NAME,
        })
        return
      }
      case 'FUSE':
        assert(this.deps.positionHandler)
        const wrapped = RefactorHelper.wrapForPositionHandler(params, {
          fspiopError: error,
          eventDetail,
          fromSwitch: true,
          toDestination: forex.externalInitiatingFspName || forex.initiatingFspName,
          messageKey,
          hubName: this.deps.config.HUB_NAME,
        })
        await this.deps.positionHandler(null, [wrapped])
    }
  }
}
