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
import { ApplicationConfig } from '../lib/config';
import { logger } from '../shared/logger';
import CentralServicesShared, { Enum, Util } from '@mojaloop/central-services-shared';
const { Kafka, Comparators } = Util

import { assertNestedFields } from '../lib/config/util';
import { toFulfil } from '../domain/transfer/transform';
const { decodePayload } = Util.StreamingProtocol
const Participant = require('../domain/participant')
const { Consumer, Producer } = require('@mojaloop/central-services-stream').Util
const { Type, Action } = Enum.Events.Event

const ErrorHandler = require('@mojaloop/central-services-error-handling')

const { FSPIOPErrorCodes } = ErrorHandler.Enums
const { FSPIOPError } = ErrorHandler
import { CreateRemittanceEntity, ProxyCache } from './transfer-types';
import RefactorHelper from '../shared/refactor-helper';
import { Effect } from '../messaging/message-bus';

interface Dependencies {
  config: ApplicationConfig
  proxyCache: ProxyCache,
  createRemittanceEntity: CreateRemittanceEntity,
  positionHandler: null | ((error: null, messages: Array<any>) => Promise<any>)

}

interface ProxyObligation {
  isFx: true,
  payloadClone: CreateForexDto,
  isInitiatingFspProxy: boolean,
  isCounterPartyFspProxy: boolean,
  initiatingFspProxyOrParticipantId: {
    inScheme: boolean,
    proxyId: string | null,
    name: string
  } | null,
  counterPartyFspProxyOrParticipantId: {
    inScheme: boolean,
    proxyId: string | null,
    name: string
  } | null
}

export interface CreateForexDto {
  commitRequestId: string,
  determiningTransferId: string,
  initiatingFsp: string,
  counterPartyFsp: string,
  amountType: 'SEND' | 'RECEIVE',
  sourceAmount: {
    amount: string,
    currency: string,
  },
  targetAmount: {
    amount: string,
    currency: string,
  }
  condition: string
  date: Date
  expiration: string,
}

export interface ForexPrepareHandlerInput {
  message: any;
  payload: CreateForexDto;
  headers: any;
  commitRequestId: string;
  action: any;
  metric: string;
  functionality: CentralServicesShared.EventTypeEnum.TRANSFER;
  actionEnum: string;
  // TODO: remove `isForwarded` antipattern.
  isForwarded: boolean
}

// TODO: I don't know what these should be!
export enum ForexPrepareResultType {
  /**
   * Prepare step completed validation
   */
  PASS = 'PASS',

  /**
   * Duplicate transfer found in a finalized state
   */
  DUPLICATE_FINAL = 'DUPLICATE_FINAL',

  /**
   * Duplicate transfer found that is still being processed
   */
  DUPLICATE_NON_FINAL = 'DUPLICATE_NON_FINAL',

  /**
   * An existing transfer exists with this id but different parameters
   */
  MODIFIED = 'MODIFIED',

  /**
   * Transfer failed validation
   */
  FAIL_VALIDATION = 'FAIL_VALIDATION',

  /**
   * Transfer failed as payee didn't have sufficent liquidity
   */
  FAIL_LIQUIDITY = 'FAIL_LIQUIDITY',

  /**
   * Catch-all Transfer failed for another reason
   */
  FAIL_OTHER = 'FAIL_OTHER',
}

export type ForexPrepareResult = {
  type: ForexPrepareResultType.PASS,
  effects: Array<Effect>
} | {
  type: ForexPrepareResultType.DUPLICATE_FINAL
  effects: Array<Effect>
  finalizedTransfer: {
    completedTimestamp: string
    transferState: 'COMMITTED' | 'ABORTED'
    fulfilment?: string
  }
} | {
  type: ForexPrepareResultType.DUPLICATE_NON_FINAL
  effects: Array<Effect>
} | {
  type: ForexPrepareResultType.MODIFIED
  effects: Array<Effect>
} | {
  type: ForexPrepareResultType.FAIL_VALIDATION
  effects: Array<Effect>
  failureReasons: Array<string>
} | {
  type: ForexPrepareResultType.FAIL_LIQUIDITY
  effects: Array<Effect>
  error: typeof FSPIOPError
} | {
  type: ForexPrepareResultType.FAIL_OTHER
  effects: Array<Effect>
  error: typeof FSPIOPError
}

interface ValidationResult {
  reasons: Array<string>, result: 'PASS' | 'FAIL'
}

export class ForexPrepareHandler {
  constructor(private deps: Dependencies) { }

  async handle(error: any, messages: any): Promise<Array<ForexPrepareResult>> {
    if (error) {
      throw error
    }

    assert(Array.isArray(messages))
    if (this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'FUSE') {
      assert(
        this.deps.positionHandler,
        'ForexPrepareHandler.deps.positionHandler not defined, positions are in `FUSE` mode.')
    }
    if (messages.length === 0) {
      logger.debug('ForexPrepareHandler.handle() - received empty batch, nothing to process');
      return []
    }

    logger.debug(`ForexPrepareHandler.handle() - processing batch of ${messages.length} messages`)
    const inputs = messages.map(message => ({
      message,
      input: this.extractMessageData(message)
    }));

    const results = await Promise.allSettled(inputs.map(async ({ input }) => this.handleOne(input)))
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.type !== ForexPrepareResultType.PASS) {
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
          type: ForexPrepareResultType.FAIL_OTHER,
          effects: [],
          error: result.reason,
        }
        case 'fulfilled': return result.value
      }
    })
  }

  async handleOne(input: ForexPrepareHandlerInput): Promise<ForexPrepareResult> {
    const remittance = this.deps.createRemittanceEntity()
    if (input.isForwarded) {
      throw new Error('TODO: handle forwarded forex prepares elsewhere')
    }

    let proxyObligation
    try {
      proxyObligation = await this.calculateProxyObligation(input.payload)
    } catch (err: any) {
      return {
        type: ForexPrepareResultType.FAIL_VALIDATION,
        effects: [],
        failureReasons: err.message
      }
    }
    assert(proxyObligation)

    const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(
      input.payload.commitRequestId,
      input.payload,
      remittance.getDuplicate,
      remittance.saveDuplicateHash
    )

    if (hasDuplicateId && !hasDuplicateHash) {
      // Id was reused for a different request.
      await this.sendMessageNotificationError(
        input,
        FSPIOPErrorCodes.MODIFIED_REQUEST.code,
        FSPIOPErrorCodes.MODIFIED_REQUEST.message
      )

      return {
        type: ForexPrepareResultType.MODIFIED,
        effects: [],
      }
    }

    // If we found the payment, we can assume it was a duplicate!
    const forex = await remittance.getByIdLight(input.payload.commitRequestId)
    if (forex && forex.fxTransferStateEnumeration) {
      switch (forex.fxTransferStateEnumeration) {
        case 'ABORTED': {
          await this.sendMessageNotificationDuplicate(input, toFulfil(forex, true))
          return {
            type: ForexPrepareResultType.DUPLICATE_FINAL,
            effects: [],
            finalizedTransfer: {
              completedTimestamp: forex.completedTimestamp,
              transferState: forex.fxTransferStateEnumeration,
            }
          }
        }
        case 'COMMITTED':
        case 'RESERVED': {
          await this.sendMessageNotificationDuplicate(input, toFulfil(forex, true))
          return {
            type: ForexPrepareResultType.DUPLICATE_FINAL,
            effects: [],
            finalizedTransfer: {
              completedTimestamp: forex.completedTimestamp,
              transferState: forex.fxTransferStateEnumeration,
              fulfilment: forex.fulfilment
            }
          }
        }
      }
    }

    // We have a duplicate message, but nothing in the database.
    if (hasDuplicateId) {
      return {
        type: ForexPrepareResultType.DUPLICATE_NON_FINAL,
        effects: [],
      }
    }

    const determiningTransferCheckResult = await remittance.checkIfDeterminingTransferExists(
      proxyObligation.payloadClone,
      proxyObligation
    )
    // Validate the payload.
    const payloadValidation = this.validatePayload(input.payload, input.headers)
    if (payloadValidation.result === 'FAIL') {
      assert(payloadValidation.reasons.length > 0)

      await remittance.savePreparedRequest(
        input.payload,
        payloadValidation.reasons.toString(),
        false,
        determiningTransferCheckResult,
        proxyObligation
      )

      return {
        type: ForexPrepareResultType.FAIL_VALIDATION,
        effects: [],
        failureReasons: payloadValidation.reasons,
      }
    }

    // Validate the participants.
    const participantValidation = await this.validateParticipants(
      determiningTransferCheckResult.participantCurrencyValidationList
    )
    if (participantValidation.result === 'FAIL') {
      assert(participantValidation.reasons.length > 0)

      await remittance.savePreparedRequest(
        input.payload,
        participantValidation.reasons.toString(),
        false,
        determiningTransferCheckResult,
        proxyObligation
      )

      return {
        type: ForexPrepareResultType.FAIL_VALIDATION,
        effects: [],
        failureReasons: participantValidation.reasons,
      }
    }

    await remittance.savePreparedRequest(
      input.payload,
      null,
      true,
      determiningTransferCheckResult,
      proxyObligation
    )

    await this.sendMessagePosition(input, determiningTransferCheckResult, proxyObligation)
    return {
      type: ForexPrepareResultType.PASS,
      effects: [],
    }
  }

  private extractMessageData(message: any): ForexPrepareHandlerInput {
    assert(message)
    assertNestedFields(message, 'value.content.headers')
    assertNestedFields(message, 'value.metadata.event.action')
    assertNestedFields(message, 'value.content.payload')

    const payloadEncoded = message.value.content.payload
    const payload = decodePayload(payloadEncoded, {}) as unknown as CreateForexDto
    const headers = message.value.content.headers

    const commitRequestId = payload.commitRequestId
    assert(commitRequestId)

    const action = message.value.metadata.event.action
    // TODO: remove this `isForwarded` antipattern.
    const isForwarded = action === Action.FX_FORWARDED
    assert(action === 'fx-prepare' || action === 'fx-forwarded',
      'message.value.metadata.action must be either `fx-prepare` or `fx-forwarded`.'
    )

    if (!isForwarded) {
      const headerSource = headers['fspiop-source'].toLowerCase()
      assert(
        headerSource === payload.initiatingFsp,
        `FSPIOP-Source header: ${headerSource} must match initiatingFsp: ${payload.initiatingFsp}.`)
    }

    return {
      message,
      payload,
      headers,
      commitRequestId,
      action,
      metric: `handler_fx_transfers_${action.toLowerCase()}`,
      functionality: Enum.Events.Event.Type.TRANSFER,
      actionEnum: this.getActionEnum(action),
      isForwarded,
    };
  }

  private getActionEnum(action: string): string {
    const actionUpper = action.toUpperCase() as keyof typeof Enum.Events.Event.Action
    return Enum.Events.Event.Action[actionUpper] || actionUpper;
  }

  private validateComplexAmount(input: { amount: string, currency: string }): ValidationResult {
    const reasons: Array<string> = []
    const [leftStr, rightStr = ''] = input.amount.split('.')
    assert(leftStr)
    assert(rightStr)
    if (rightStr.length > this.deps.config.AMOUNT.SCALE) {
      reasons.push(
        `Amount ${input.amount} exceeds allowed scale of ${this.deps.config.AMOUNT.SCALE}`
      )
    }
    const precision = leftStr.length + rightStr.length
    if (precision > this.deps.config.AMOUNT.PRECISION) {
      reasons.push(
        `Amount ${precision} exceeds allowed precision of ${this.deps.config.AMOUNT.PRECISION}`
      )
    }

    return {
      result: reasons.length === 0 ? 'PASS' : 'FAIL',
      reasons
    }
  }

  private validatePayload(payload: CreateForexDto, headers: any): ValidationResult {
    let reasons: Array<string> = []
    assert(payload)
    assert(headers)

    if (headers['fspiop-source'] !== payload.initiatingFsp) {
      reasons.push(`FSPIOP-Source header (${headers?.['fspiop-source']}) \
should match initiatingFsp (${payload.initiatingFsp})`)
    }
    reasons = reasons.concat(this.validateComplexAmount(payload.sourceAmount).reasons)
    reasons = reasons.concat(this.validateComplexAmount(payload.targetAmount).reasons)

    if (!this.deps.config.ENABLE_ON_US_TRANSFERS) {
      if (payload.initiatingFsp === payload.counterPartyFsp) {
        reasons.push(
          'Payer FSP and Payee FSP should be different, unless on-us tranfers are allowed by the Scheme'
        )
      }
    }

    if (!payload.condition) {
      reasons.push('Condition is required for a conditional transfer')
    } else {
      const buffer = Buffer.from(payload.condition, 'base64')
      if (buffer.length !== 32) {
        logger.info(`validateInput() condition validation failed.`)
        reasons.push('Condition validation failed')
      }
    }

    if (!payload.expiration) {
      reasons.push('Expiration is required for conditional transfer')
    } else {
      if (Date.parse(payload.expiration) < Date.parse(new Date().toISOString())) {
        reasons.push(`Expiration date ${new Date(payload.expiration).toISOString()} is already in the past`)
      }
    }

    return {
      result: reasons.length === 0 ? 'PASS' : 'FAIL',
      reasons
    }
  }

  private async validateParticipants(
    participantCurrencyValidationList: Array<{ participantName: string; currencyId: string }>
  ): Promise<ValidationResult> {
    const reasons: Array<string> = []
    for (const { participantName, currencyId } of participantCurrencyValidationList) {
      const account = await Participant.getAccountByNameAndCurrency(
        participantName,
        currencyId,
        Enum.Accounts.LedgerAccountType.POSITION,
      )
      if (!account) {
        reasons.push(`Participant ${participantName} ${currencyId} account not found`)
      } else if (!account.currencyIsActive) {
        reasons.push(`Participant ${participantName} ${currencyId} account is inactive`)
      }
    }

    return {
      result: reasons.length === 0 ? 'PASS' : 'FAIL',
      reasons
    }
  }

  /**
   * @description Figure out if the participants in the Payment message are native to the scheme
   * or are proxies.
   */
  private async calculateProxyObligation(payload: CreateForexDto): Promise<ProxyObligation> {
    // If the proxy isn't enabled, just return the default.
    if (!this.deps.config.PROXY_CACHE_CONFIG.enabled) {
      return {
        isFx: true,
        payloadClone: { ...payload },  // just a copy of the original payload
        isInitiatingFspProxy: false,
        isCounterPartyFspProxy: false,
        initiatingFspProxyOrParticipantId: {
          inScheme: true, proxyId: null, name: payload.initiatingFsp,
        },
        counterPartyFspProxyOrParticipantId: {
          inScheme: true, proxyId: null, name: payload.counterPartyFsp
        }
      }
    }

    // We need to double check the following validation logic incase of payee side currency conversion
    const payerResult = await this.deps.proxyCache.getFSPProxy(payload.initiatingFsp)
    const payeeResult = await this.deps.proxyCache.getFSPProxy(payload.counterPartyFsp, null)
    assert(payerResult)
    assert(payeeResult)

    // Validate the not found case.
    if (payerResult.inScheme === false && payerResult.proxyId === null) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND,
        `Payer proxy or participant not found: initiatingFsp: ${payload.initiatingFsp}.`
      )
      throw fspiopError
    }
    if (payeeResult.inScheme === false && payeeResult.proxyId === null) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND,
        `Payee proxy or participant not found: counterPartyFsp: ${payload.counterPartyFsp}.`
      )
      throw fspiopError
    }

    const isInitiatingFspProxy = !payerResult.inScheme && payerResult.proxyId !== null
    const isCounterPartyFspProxy = !payeeResult.inScheme && payeeResult.proxyId !== null

    return {
      isFx: true,
      payloadClone: {
        ...payload,
        // Reroute the proxies.
        initiatingFsp: isInitiatingFspProxy ? payerResult.proxyId! : payload.initiatingFsp,
        counterPartyFsp: isCounterPartyFspProxy ? payeeResult.proxyId! : payload.counterPartyFsp
      },
      isInitiatingFspProxy,
      isCounterPartyFspProxy,
      initiatingFspProxyOrParticipantId: payerResult,      // Set the lookup result!
      counterPartyFspProxyOrParticipantId: payeeResult     // Set the lookup result!
    }
  }

  private async sendMessagePosition(
    input: ForexPrepareHandlerInput,
    determiningTransferCheckResult: any,
    proxyObligation: ProxyObligation
  ): Promise<void> {
    const config = this.deps.config
    const remittance = this.deps.createRemittanceEntity()

    const cyrilResult = await remittance.getPositionParticipant(
      proxyObligation.payloadClone,
      determiningTransferCheckResult,
      proxyObligation
    )

    const account = await Participant.getAccountByNameAndCurrency(
      cyrilResult.participantName,
      cyrilResult.currencyId,
      Enum.Accounts.LedgerAccountType.POSITION
    )
    const messageKey = account.participantCurrencyId.toString()

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

    switch (this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE) {
      case 'UNFUSE': {
        await Kafka.proceed(config.KAFKA_CONFIG, params, {
          consumerCommit: true,
          eventDetail: {
            functionality: Type.POSITION,
            action: Action.FX_PREPARE
          },
          messageKey,
          topicNameOverride: config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.FX_PREPARE,
          hubName: config.HUB_NAME
        })
        return
      }
      case 'FUSE': {
        assert(this.deps.positionHandler)
        const wrapped = RefactorHelper.wrapForPositionHandler(params, {
          eventDetail: {
            functionality: Type.POSITION,
            action: Action.FX_PREPARE
          },
          messageKey,
          hubName: config.HUB_NAME
        })
        await this.deps.positionHandler(null, [wrapped])
      }
    }
  }

  private async sendMessageNotificationDuplicate(input: ForexPrepareHandlerInput, payload: any): Promise<void> {
    // Emit a notification message.
    const params = {
      message: input.message,
      kafkaTopic: input.message.topic,
      decodedPayload: input.payload,
      span: null,
      consumer: Consumer,
      producer: Producer
    }

    params.message.value.content.payload = payload
    params.message.value.content.uriParams = { id: input.payload.commitRequestId }
    await Kafka.proceed(
      this.deps.config.KAFKA_CONFIG,
      params,
      {
        consumerCommit: true,
        eventDetail: {
          action: 'fx-prepare-duplicate',
          functionality: 'notification',
        },
        fromSwitch: true,
        hubName: this.deps.config.HUB_NAME
      })
  }

  private async sendMessageNotificationError(
    input: ForexPrepareHandlerInput,
    errorCode: string,
    errorDescription: string
  ): Promise<void> {
    const config = this.deps.config

    const fspiopError = ErrorHandler.Factory.createFSPIOPError(
      { code: errorCode, message: errorDescription }
    ).toApiErrorObject(config.ERROR_HANDLING)

    const params = {
      message: input.message,
      kafkaTopic: input.message.topic,
      decodedPayload: input.payload,
      span: null,
      consumer: Consumer,
      producer: Producer
    }

    await Kafka.proceed(config.KAFKA_CONFIG, params, {
      consumerCommit: true,
      fspiopError,
      eventDetail: {
        functionality: Type.NOTIFICATION,
        action: Action.FX_PREPARE
      },
      fromSwitch: true,
      hubName: config.HUB_NAME
    })
  }

}
