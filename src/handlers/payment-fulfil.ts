
import crypto, { hash } from 'node:crypto'
import assert, { Assert } from "node:assert";
import { ApplicationConfig } from "../lib/config";
import { logger } from '../shared/logger';
import CentralServicesShared, { Enum, TransferStateEnum, Util, EventActionEnum } from '@mojaloop/central-services-shared';
const { Kafka, Comparators } = Util
import { createRemittanceEntityPayment } from "./transfers/createRemittanceEntity";
import TransferService, { getTransferFulfilmentDuplicateCheck, saveTransferErrorDuplicateCheck, saveTransferFulfilmentDuplicateCheck } from "../domain/transfer";
import { buffer } from 'node:stream/consumers';
import { getTransferErrorDuplicateCheck } from '#src/models/transfer/transferErrorDuplicateCheck';
const { decodePayload } = Util.StreamingProtocol
const Validator = require('./transfers/validator')
const Participant = require('../domain/participant')
const { Consumer, Producer } = require('@mojaloop/central-services-stream').Util
const { Type, Action } = Enum.Events.Event

const ErrorHandler = require('@mojaloop/central-services-error-handling')

const { FSPIOPErrorCodes } = ErrorHandler.Enums
const { createFSPIOPError, reformatFSPIOPError } = ErrorHandler.Factory
const { FSPIOPError } = ErrorHandler

import FxService from '../domain/fx'

interface Dependencies {
  config: ApplicationConfig
}

export type CommitPaymentDto = {
  transferState: 'COMMITTED' | 'RESERVED' | 'RESERVED_FORWARDED',
  fulfilment: string,
  completedTimestamp: string,
} | {
  transferState: 'ABORTED',
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
type CommitPaymentDtoAborted = Extract<CommitPaymentDto, { transferState: 'ABORTED' }>;

export type FulfilHandlerAction = EventActionEnum.ABORT
  | EventActionEnum.COMMIT
  | EventActionEnum.RESERVE;

export interface FusedFulfilHandlerInput {
  message: any;
  payload: CommitPaymentDto
  headers: Record<string, any>;
  /**
   * The mojaloop logical transfer id
   */
  transferId: string;
  action: FulfilHandlerAction;
  eventType: string;
  kafkaTopic: string;
  /**
   * The DFSP ID of the caller, extracted from FSPIOP-Source header
   */
  callerDfspId: string;
}

export enum PaymentFulfilResultType {
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

export type PaymentFulfilResult = {
  type: PaymentFulfilResultType.PASS
} | {
  type: PaymentFulfilResultType.DUPLICATE_FINAL
} | {
  type: PaymentFulfilResultType.DUPLICATE_NON_FINAL
  // TODO: is there a body for this?
} | {
  type: PaymentFulfilResultType.FAIL_VALIDATION
  error: typeof FSPIOPError
} | {
  type: PaymentFulfilResultType.FAIL_OTHER
  error: typeof FSPIOPError
}

export class PaymentFulfilHandler {
  constructor(private deps: Dependencies) { }

  /**
   * Handle a batch of messages coming off of Kafka.
   */
  async handle(
    error: any, messages: any
  ): Promise<Array<PromiseSettledResult<PaymentFulfilResult>>> {
    if (error) {
      throw error
    }

    assert(Array.isArray(messages))
    if (messages.length === 0) {
      logger.debug('PaymentFulfilHandler.handle() - received empty batch, nothing to process');
      return []
    }

    logger.debug(`PaymentFulfilHandler.handle() - processing batch of ${messages.length} messages`)

    const inputs = messages.map(message => ({
      message,
      input: this.extractMessageData(message)
    }));

    const results = await Promise.allSettled(inputs.map(async ({ input }) => this.handleOne(input)))
    results.filter(result => result.status === 'rejected')
      .forEach(result => {
        logger.error(`handleOne() failed with error: \n\t${result.reason}`)
        if (result.reason.stack) logger.error(`stack\n\t${result.reason.stack}`)
      })

    return results
  }

  async handleOne(input: FusedFulfilHandlerInput): Promise<PaymentFulfilResult> {
    // Shortcut.
    const { transferId, payload } = input
    const transfer = await TransferService.getById(transferId)
    if (!transfer) {
      return {
        type: PaymentFulfilResultType.FAIL_OTHER,
        error: ErrorHandler.Factory.createInternalServerFSPIOPError(
          `transfer not found for id: ${transferId}.`
        )
      }
    }

    // Ensure that the FSPIOP-Source matches the payee.
    // TODO: the original has a bunch of proxy stuff, but I don't understand it, so I'm leaving it
    // out for now.

    if (transfer.payeeIsProxy) {
      // Handle proxied payment case
      if (input.callerDfspId !== transfer.externalPayeeName) {
        const error = ErrorHandler.Factory.createInternalServerFSPIOPError(
          `${input.callerDfspId} does not match externalPayeeName: ${transfer.externalPayeeName} \
on the Fulfil callback response.`
        )
        // Transfer aborted.
        await TransferService.handlePayeeResponse(
          transferId,
          payload,
          'abort-validation',
          // TODO: need to figure out how to format this.
          error
        )

        await this.sendPositionMessageRollback(input, transfer, error)
        return { type: PaymentFulfilResultType.FAIL_VALIDATION, error }
      }
    } else {
      if (input.callerDfspId !== transfer.payeeFsp) {
        const error = ErrorHandler.Factory.createInternalServerFSPIOPError(
          `${input.callerDfspId} does not match payer fsp: ${transfer.payeeFsp} \
on the Fulfil callback response.`
        )
        // Transfer aborted.
        await TransferService.handlePayeeResponse(
          transferId,
          payload,
          'abort-validation',
          // TODO: need to figure out how to format this.
          error
        )

        await this.sendPositionMessageRollback(input, transfer, error)
        return { type: PaymentFulfilResultType.FAIL_VALIDATION, error }
      }
    }

    const payloadHash = PaymentFulfilHandler._hashPayload(payload)
    if (transfer.transferState === 'COMMITTED') {
      // Payment is finalized. Check to see if this is an exact duplicate Fulfil message, or if the
      // fulfil message was modified in some way.
      let savedFulfilHash
      try {
        savedFulfilHash = (await getTransferFulfilmentDuplicateCheck(transferId)).hash
        if (savedFulfilHash === payloadHash) {
          // Safe to ignore, we saw the same fulfil message before.
          return {
            type: PaymentFulfilResultType.DUPLICATE_FINAL
          }
        }
        // Modified message.
        return {
          type: PaymentFulfilResultType.FAIL_VALIDATION,
          error: ErrorHandler.Factory.createInternalServerFSPIOPError(
            `detected transfer fulfil message modified for transferId: ${transferId}.`
          )
        }
      } catch (err) {
        const error = ErrorHandler.Factory.createInternalServerFSPIOPError(
          'found finalized transfer, but no `getTransferFulfilmentDuplicateCheck`'
        )
        logger.error(error.message)
        return {
          type: PaymentFulfilResultType.FAIL_OTHER,
          error,
        }
      }
    }

    // TODO: in these steps we need to do the transferFulfilmentDuplicateCheck step 
    if (transfer.transferState === 'ABORTED') {
      // Payment is finalized. Check to see if this is an exact duplicate Fulfil message, or if the
      // fulfil message was modified in some way.
      let savedHash
      try {
        savedHash = (await getTransferErrorDuplicateCheck(transferId)).hash
        if (savedHash === payloadHash) {
          // Safe to ignore, we saw the same fulfil message before.
          return {
            type: PaymentFulfilResultType.DUPLICATE_FINAL
          }
        }
        // Modified message.
        return {
          type: PaymentFulfilResultType.FAIL_VALIDATION,
          error: ErrorHandler.Factory.createInternalServerFSPIOPError(
            `detected transfer fulfil message modified for transferId: ${transferId}.`
          )
        }
      } catch (err) {
        const error = ErrorHandler.Factory.createInternalServerFSPIOPError(
          'found finalized transfer, but no `getTransferFulfilmentDuplicateCheck`'
        )
        logger.error(error.message)
        return {
          type: PaymentFulfilResultType.FAIL_OTHER,
          error,
        }
      }
    }

    // According to:
    // https://docs.mojaloop.io/api/fspiop/v1.1/api-definition.html#put-transfers-id
    // "For PUT /transfers/{ID} callbacks, the state ABORTED is not a valid enumeration option as 
    // transferState in Table 32. If a transfer is to be rejected, then the FSP making the callback
    // should use an error callback, i.e., a callback on the /error endpoint.
    if (input.action === 'abort') {
      const errorPayload = payload as CommitPaymentDtoAborted
      const fspiopError = ErrorHandler.Factory.createFSPIOPErrorFromErrorInformation(
        errorPayload.errorInformation
      )
      
      // Payee aborted the transfer, save to DB.
      await saveTransferErrorDuplicateCheck(transferId, payloadHash)
      await TransferService.handlePayeeResponse(
        transferId,
        errorPayload,
        input.action,
        // TODO: need to figure out how to format this.
        fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)
      )

      // TODO: Rollback the position.
      // TODO: not sure about error formatting.
      await this.sendPositionMessageRollback(input, transfer, errorPayload)
      return {
        type: PaymentFulfilResultType.PASS
      }
    }

    assert(
      payload.transferState === 'COMMITTED' || 
      payload.transferState === 'RESERVED' ||
      payload.transferState === 'RESERVED_FORWARDED'
    )
    if (transfer.expirationDate <= new Date(Util.Time.getUTCString(new Date()))) {
      return {
        type: PaymentFulfilResultType.FAIL_VALIDATION,
        error: ErrorHandler.Factory.createInternalServerFSPIOPError(
          `transfer timed out.`
        )
      }
    }

    await saveTransferFulfilmentDuplicateCheck(transferId, payloadHash)
    if (!PaymentFulfilHandler._fulfilmentMatchesCondition(payload.fulfilment, transfer.condition)) {
      // Payee sent an invalid position. Need to abort the payment.
      const error = ErrorHandler.Factory.createInternalServerFSPIOPError(
        `fulfilment does not match condition.`
      )
      // Transfer aborted.
      await TransferService.handlePayeeResponse(
        transferId,
        payload,
        'abort-validation',
        // TODO: need to figure out how to format this.
        error
      )

      await this.sendPositionMessageRollback(input, transfer, error)
      return { type: PaymentFulfilResultType.FAIL_VALIDATION, error }
    }

    // Happy path - validation passed.
    await TransferService.handlePayeeResponse(transferId, payload, input.action)
    await this.sendPositionMessageCommit(input, transfer)
    return {
      type: PaymentFulfilResultType.PASS
    }
  }

  public static _fulfilmentMatchesCondition(fulfilment: string, condition: string): boolean {
    const derivedCondition = this._fulfilmentToCondition(fulfilment)
    return derivedCondition === condition
  }

  public static _fulfilmentToCondition(fulfilment: string) {
    const hashSha256 = crypto.createHash('sha256')
    const preimage = Buffer.from(fulfilment, 'base64url')

    if (preimage.length !== 32) {
      throw ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR,
        'Interledger preimages must be exactly 32 bytes'
      )
    }
    return hashSha256.update(preimage).digest('base64url').toString()
  }

  public static _hashPayload(payload: CommitPaymentDto) {
    const cryptoHash = crypto.createHash('sha256')
    cryptoHash.update(JSON.stringify(payload))
    const hash = cryptoHash.digest('base64url')
    assert(hash.at(-1) !== '=', 'Hash should not have trailing `=`.')

    return hash
  }

  private extractMessageData(message: any): FusedFulfilHandlerInput {
    assert(message);
    assert(message.value);
    assert(message.value.content);
    assert(message.value.metadata);
    assert(message.value.metadata.event);

    const payloadEncoded = message.value.content.payload;
    // Fulfil messages always use CommitPaymentDto
    // TODO: handle AbortPaymentDto
    const payload = decodePayload(payloadEncoded, {}) as CommitPaymentDto;
    const eventType = message.value.metadata.event.type;
    const headers = message.value.content.headers;

    // Validate API Version. TransferState.RESERVED is not allowed in FSPIOP v1.0
    // TODO: Why isn't this in the ml-api-adapter layer? It feels like it doesn't belong here.
    const contentTypeStr = headers['content-type']
    assert(contentTypeStr, 'No `content-type` header found.')
    assert(typeof contentTypeStr === 'string', '`content-type` header should be a string')
    const [_, apiVersionStr] = contentTypeStr.split('=')
    assert(apiVersionStr, 'Malformed `content-type` string.')
    if (contentTypeStr === '1.0' && payload.transferState === 'RESERVED') {
      throw new Error(`action "RESERVE" is not allowed in fulfil handler for v1.0 clients.`)
    }

    assert(message.value.content.uriParams);
    assert(message.value.content.uriParams.id);
    const transferId = message.value.content.uriParams.id;
    assert(transferId, 'could not parse transferId');

    // TODO(LD): what should action be?
    const actionStr = message.value.metadata.event.action;
    assert(actionStr)
    let action: FulfilHandlerAction
    switch (actionStr) {
      case Enum.Events.Event.Action.ABORT:
      case Enum.Events.Event.Action.COMMIT:
      case Enum.Events.Event.Action.RESERVE:
        action = actionStr as FulfilHandlerAction
        break;
      case Enum.Events.Event.Action.BULK_ABORT:
      case Enum.Events.Event.Action.BULK_COMMIT:
      default:
        throw new Error(`FusedFulfilHandler.extractMessageData() - unexpected action: ${actionStr}.`)
    }

    // Extract caller DFSP ID from FSPIOP-Source header.
    const callerDfspId = headers['fspiop-source'];
    assert(callerDfspId, '`callerDfspId` (FSPIOP-Source header) is required.');
    assert(typeof callerDfspId === 'string', '`callerDfspId` must be a string.');

    return {
      message,
      payload,
      headers,
      transferId,
      action,
      eventType,
      kafkaTopic: message.topic,
      callerDfspId
    };
  }

  /**
   * TODO: this will eventually be removed when we migrate to the fused handlers.
   */
  private async sendPositionMessageCommit(
    input: FusedFulfilHandlerInput,
    transfer: any
  ): Promise<void> {
    // Shortcut.
    const config = this.deps.config
    const params = {
      message: input.message,
      kafkaTopic: input.kafkaTopic,
      decodedPayload: input.payload,
      span: null,
      consumer: Consumer,
      producer: Producer
    }

    // TODO: better typing.
    const cyrilResult = await FxService.Cyril.processFulfilMessage(
      input.transferId,
      input.payload,
      transfer
    )
    let messageKey: string
    if (cyrilResult.isFx && cyrilResult.positionChanges.length > 0) {
      // Forex + Payment.
      // @ts-ignore
      messageKey = cyrilResult.positionChanges[0].participantCurrencyId.toString()
      params.message.value.content.context = {
        ...params.message.value.content.context,
        cyrilResult
      }
    } else {
      // Standalone Payment
      const payeeAccount = await Participant.getAccountByNameAndCurrency(
        transfer.payeeFsp, transfer.currency, Enum.Accounts.LedgerAccountType.POSITION,
      )
      messageKey = payeeAccount.participantCurrencyId.toString()
    }

    assert(messageKey)

    // TODO: can we remove these?
    const topicNameOverride = input.action === 'commit'
      ? config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.COMMIT
      : config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.RESERVE

    await Kafka.proceed(config.KAFKA_CONFIG, params, {
      consumerCommit: true,
      eventDetail: {
        functionality: Enum.Events.Event.Type.POSITION,
        action: input.action
      },
      messageKey,
      topicNameOverride,
      hubName: config.HUB_NAME
    })
  }

  private async sendPositionMessageRollback(
    input: FusedFulfilHandlerInput,
    transfer: any,
    error: {
      errorInformation: {
        errorCode: string,
        errorDescription: string,
      }
    }
  ): Promise<void> {
    // Shortcut.
    const config = this.deps.config
    const params = {
      message: input.message,
      kafkaTopic: input.kafkaTopic,
      decodedPayload: input.payload,
      span: null,
      consumer: Consumer,
      producer: Producer
    }

    // Assertions that should live on the kafka library.
    assert(error)
    assert(error.errorInformation)
    assert(error.errorInformation.errorCode)
    assert(error.errorInformation.errorDescription)

    // TODO: we shouldn't know anything about the "FXService" here.
    const cyrilResult = await FxService.Cyril.processAbortMessage(input.transferId)

    // If a payment has a linked forex, we first set their state to RECEIVED_ERROR otherwise the
    // position handler ignores the position reset.
    for (const positionChange of cyrilResult.positionChanges) {
      if (positionChange.isFxTransferStateChange) {
        await FxService.handleFulfilResponse(
          positionChange.commitRequestId,
          error,
          Action.FX_ABORT,
          error
        )
      }
    }

    params.message.value.content.context = {
      ...params.message.value.content.context,
      cyrilResult
    }
    let messageKey: string
    if (cyrilResult.positionChanges.length > 0) {
      // @ts-ignore
      messageKey = cyrilResult.positionChanges[0].participantCurrencyId.toString()
    } else {
      // Fallback to payer account
      const payerAccount = await Participant.getAccountByNameAndCurrency(
        transfer.payerFsp,
        transfer.currency,
        Enum.Accounts.LedgerAccountType.POSITION
      )
      messageKey = payerAccount.participantCurrencyId.toString()
    }
    assert(messageKey)

    await Kafka.proceed(config.KAFKA_CONFIG, params, {
      consumerCommit: true,
      fspiopError: error,
      eventDetail: {
        functionality: Enum.Events.Event.Type.POSITION,
        action: 'abort'
      },
      messageKey,
      topicNameOverride: config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.ABORT,
      hubName: config.HUB_NAME
    })
  }
}
