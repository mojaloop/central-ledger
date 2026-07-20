import assert from "node:assert";
import crypto from 'node:crypto';

import { Enum, Util} from '@mojaloop/central-services-shared'
const { Kafka } = Util
const { decodePayload } = Util.StreamingProtocol

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { FSPIOPError } = ErrorHandler

import { ApplicationConfig } from "../lib/config";
import { assertNestedFields } from "../lib/config/util";
import { getFxTransferDuplicateCheck, getFxTransferErrorDuplicateCheck } from "../models/fxTransfer/duplicateCheck";
import FxTransferModel, { saveFxFulfilResponse } from '../models/fxTransfer/fxTransfer';
import fspiopErrorFactory from "../shared/fspiopErrorFactory";
import { logger } from '../shared/logger';
import { TransferHelper } from "./transfer-helper";

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
}

interface KafkaParams {
  message: any
  kafkaTopic: string
  decodedPayload: CommitForexDto
  span: any
  consumer: any
  producer: any
}

interface ProxyObligation {
  isFx: true,
  payloadClone: CommitForexDto,
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

// TODO: I don't know what these should be!
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
  type: ForexFulfilResultType.PASS
} | {
  type: ForexFulfilResultType.DUPLICATE_FINAL
} | {
  type: ForexFulfilResultType.DUPLICATE_NON_FINAL
  // TODO: is there a body for this?
} | {
  type: ForexFulfilResultType.FAIL_VALIDATION
  error: typeof FSPIOPError
} | {
  type: ForexFulfilResultType.FAIL_OTHER
  error: typeof FSPIOPError
}

interface ValidationResult {
  reasons: Array<string>, result: 'PASS' | 'FAIL'
}

export class ForexFulfilHandler {
  constructor(private deps: Dependencies) { }

  async handle(error: any, messages: any): Promise<Array<PromiseSettledResult<ForexFulfilResult>>> {
    if (error) {
      throw error
    }

    assert(Array.isArray(messages))
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
    return results
  }

  async handleOne(input: ForexFulfilHandlerInput): Promise<ForexFulfilResult> {
    const { commitRequestId, type, action } = input

    const forex = await FxTransferModel
      .getAllDetailsByCommitRequestIdForProxiedFxTransfer(commitRequestId)
    if (!forex) {
      const fspiopError = fspiopErrorFactory.fxTransferNotFound()
      await this.sendNotificationMessageError(input, fspiopError)
      const error = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)

      return {
        type: ForexFulfilResultType.FAIL_VALIDATION,
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
      await this.sendPositionMessageRollback(input, forex, apiFSPIOPError, {
        functionality: 'position',
        action: 'fx-abort'
      })

      return {
        type: ForexFulfilResultType.FAIL_VALIDATION,
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
            type: ForexFulfilResultType.DUPLICATE_FINAL
          }
        }

        // Modified payload.
        return {
          type: ForexFulfilResultType.FAIL_VALIDATION,
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
            type: ForexFulfilResultType.DUPLICATE_FINAL
          }
        }
        // Modified message.
        return {
          type: ForexFulfilResultType.FAIL_VALIDATION,
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
      
      await this.sendPositionMessageRollback(input, forex, apiFSPIOPError, {
        functionality: 'position',
        action: 'fx-abort'
      })
      
      return {
        type: ForexFulfilResultType.PASS
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

      await this.sendPositionMessageRollback(input, forex, apiFSPIOPError, {
        functionality: 'position',
        action: 'fx-abort-validation'
      })

      return {
        type: ForexFulfilResultType.FAIL_VALIDATION,
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
      await this.sendPositionMessageRollback(input, forex, apiFSPIOPError, {
        functionality: 'position',
        action: 'fx-abort-validation'
      })

      return {
        type: ForexFulfilResultType.FAIL_VALIDATION,
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
      await this.sendPositionMessageRollback(input, forex, apiFSPIOPError, {
        functionality: 'position',
        action: 'fx-abort-validation'
      })

      return {
        type: ForexFulfilResultType.FAIL_VALIDATION,
        error: apiFSPIOPError,
      }
    }

    // Validations passed.    
    await saveFxFulfilResponse(commitRequestId, input.payload, action)
    await this.deps.cyril.processFxFulfilMessage(commitRequestId)
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
    await Kafka.proceed(this.deps.config.KAFKA_CONFIG, params,
      {
        consumerCommit: true,
        eventDetail,
        messageKey: forex.counterPartyFspSourceParticipantCurrencyId.toString(),
        topicNameOverride: this.deps.config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.COMMIT
      }
    )
    return {
      type: ForexFulfilResultType.PASS
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
    assert(action === 'fx-commit' || 'fx-reserve' || 'fx-abort',
      'message.value.metadata.action must be either `fx-fulfil` or `fx-abort`.'
    )

    return {
      message,
      payload,
      headers,
      commitRequestId,
      type: message.value.metadata.event.type,
      action,
      metric: `handler_fx_transfers_${action.toLowerCase()}`,
      functionality: Enum.Events.Event.Type.TRANSFER,
      // TODO: simplify.
      actionEnum: this.getActionEnum(action),
    };
  }

  private getActionEnum(action: string): string {
    const actionUpper = action.toUpperCase() as keyof typeof Enum.Events.Event.Action
    return Enum.Events.Event.Action[actionUpper] || actionUpper;
  }

  private async sendNotificationMessageError(
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

  private async sendPositionMessageRollback(
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
    await Kafka.proceed(this.deps.config.KAFKA_CONFIG, params, {
      consumerCommit: true,
      fspiopError: error,
      eventDetail,
      fromSwitch: true,
      toDestination: forex.externalInitiatingFspName || forex.initiatingFspName,
      messageKey: participantCurrencyId.toString(),
      topicNameOverride: this.deps.config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.FX_ABORT,
      hubName: this.deps.config.HUB_NAME,
    })
  }
}
