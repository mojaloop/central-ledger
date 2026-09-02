/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
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

import assert from 'node:assert'
import { ApplicationConfig } from '../lib/config'
import { logger } from '../shared/logger'
import { Enum, Util, EventActionEnum } from '@mojaloop/central-services-shared'
import TransferService, {
  getTransferFulfilmentDuplicateCheck,
  saveTransferErrorDuplicateCheck,
  saveTransferFulfilmentDuplicateCheck
} from "../domain/transfer"
import { getTransferErrorDuplicateCheck } from '../models/transfer/transferErrorDuplicateCheck'
const { decodePayload } = Util.StreamingProtocol
const Participant = require('../domain/participant')
const { Type, Action } = Enum.Events.Event
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { FSPIOPError } = ErrorHandler

import { TransferHelper } from './transfer-helper';
import { Effect, MessageBus } from "../messaging/message-bus";
import { PositionHandlerV2, PositionResultType } from "./position-v2";
import { assertNestedFields } from "../lib/config/util";

interface Dependencies {
  config: ApplicationConfig
  fxService: any
  positionHandler: PositionHandlerV2
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
   * The Mojaloop logical transfer id.
   */
  transferId: string;
  action: FulfilHandlerAction;
  eventType: string;
  kafkaTopic: string;
  /**
   * The DFSP ID of the caller, extracted from FSPIOP-Source header.
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
  type: PaymentFulfilResultType.PASS,
  effects: Array<Effect>
} | {
  type: PaymentFulfilResultType.DUPLICATE_FINAL,
  effects: Array<Effect>
} | {
  type: PaymentFulfilResultType.DUPLICATE_NON_FINAL,
  effects: Array<Effect>
  // TODO: is there a body for this?
} | {
  type: PaymentFulfilResultType.FAIL_VALIDATION,
  effects: Array<Effect>
  error: typeof FSPIOPError
} | {
  type: PaymentFulfilResultType.FAIL_OTHER
  effects: Array<Effect>
  error: typeof FSPIOPError
}

export class PaymentFulfilHandler {
  constructor(private deps: Dependencies) { }

  /**
   * Handle a batch of messages coming off of Kafka.
   */
  async handle(
    error: any, messages: any
  ): Promise<Array<PaymentFulfilResult>> {
    if (error) {
      throw error
    }

    assert(Array.isArray(messages))
    if (this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'FUSE') {
      assert(
        this.deps.positionHandler,
        'PaymentFulfilHandler.deps.positionHandler not defined, positions are in `FUSE` mode.')
    }

    if (messages.length === 0) {
      logger.debug('PaymentFulfilHandler.handle() - received empty batch, nothing to process');
      return []
    }

    logger.debug(`PaymentFulfilHandler.handle() - processing batch of ${messages.length} messages`)

    const inputs = messages.map(message => ({
      message,
      input: this.extractMessageData(message)
    }));

    // TODO: call Ledger.fulfil(inputs)

    const results = await Promise.allSettled(inputs.map(async ({ input }) => this.handleOne(input)))
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.type !== PaymentFulfilResultType.PASS) {
        logger.info(`handleOne() returned non-success: \n\t${JSON.stringify(result.value)}`)
      }
      if (result.status === 'rejected') {
        logger.error(`handleOne() failed with error: \n\t${result.reason}`)
        if (result.reason.stack) logger.error(`stack\n\t${result.reason.stack}`)
      }
    })

    return results.map(result => {
      switch (result.status) {
        case 'rejected': return {
          type: PaymentFulfilResultType.FAIL_OTHER,
          error: result.reason,
          effects: []
        }
        case 'fulfilled': return result.value
      }
    })
  }

  async handleOne(input: FusedFulfilHandlerInput): Promise<PaymentFulfilResult> {
    // Shortcut.
    const { transferId, payload } = input
    const transfer = await TransferService.getById(transferId)
    if (!transfer) {
      return {
        type: PaymentFulfilResultType.FAIL_OTHER,
        effects: [],
        error: ErrorHandler.Factory.createInternalServerFSPIOPError(
          `transfer not found for id: ${transferId}.`
        )
      }
    }

    // Ensure that the FSPIOP-Source matches the payee.
    // TODO: the original has a bunch of proxy stuff, but I don't understand it, so I'm leaving it
    // out for now.
    if (transfer.payeeIsProxy) {
      if (input.callerDfspId !== transfer.externalPayeeName) {
        const errorFspiop = ErrorHandler.Factory.createInternalServerFSPIOPError(
          `${input.callerDfspId} does not match externalPayeeName: ${transfer.externalPayeeName} \
on the Fulfil callback response.`
        )
        const error = errorFspiop.toApiErrorObject(this.deps.config.ERROR_HANDLING)
        // Transfer aborted.
        await TransferService.handlePayeeResponse(
          transferId,
          payload,
          'abort-validation',
          error
        )

        const effect = await this.buildEffectPositionRollback(input, transfer, error)
        return this.handleNext({
          type: PaymentFulfilResultType.FAIL_VALIDATION,
          effects: [effect],
          error
        })
      }
    } else {
      if (input.callerDfspId !== transfer.payeeFsp) {
        const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          `caller fsp does not match payment.payeeFsp.`
        )
        const error = errorFspiop.toApiErrorObject(this.deps.config.ERROR_HANDLING)

        // Transfer aborted.
        await TransferService.handlePayeeResponse(
          transferId,
          payload,
          'abort-validation',
          error
        )

        const effect = await this.buildEffectPositionRollback(input, transfer, error)
        return this.handleNext({
          type: PaymentFulfilResultType.FAIL_VALIDATION,
          effects: [effect],
          error
        })
      }
    }

    const payloadHash = TransferHelper.hashPayload(payload)
    if (transfer.transferState === 'COMMITTED') {
      // Payment is finalized. Check to see if this is an exact duplicate Fulfil message, or if the
      // fulfil message was modified in some way.
      let savedFulfilHash
      try {
        savedFulfilHash = (await getTransferFulfilmentDuplicateCheck(transferId)).hash
        if (savedFulfilHash === payloadHash) {
          // Safe to ignore, we saw the same fulfil message before.
          return {
            type: PaymentFulfilResultType.DUPLICATE_FINAL,
            effects: [],
          }
        }
        // Modified message.
        return {
          type: PaymentFulfilResultType.FAIL_VALIDATION,
          effects: [],
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
          effects: [],
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
            type: PaymentFulfilResultType.DUPLICATE_FINAL,
            effects: [],
          }
        }
        // Modified message.
        return {
          type: PaymentFulfilResultType.FAIL_VALIDATION,
          effects: [],
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
          effects: [],
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
      const errorFspiop = ErrorHandler.Factory.createFSPIOPErrorFromErrorInformation(
        errorPayload.errorInformation
      )
      const errorApi = errorFspiop.toApiErrorObject(this.deps.config.ERROR_HANDLING)

      // Payee aborted the transfer, save to DB.
      await saveTransferErrorDuplicateCheck(transferId, payloadHash)
      await TransferService.handlePayeeResponse(
        transferId,
        errorPayload,
        input.action,
        errorApi
      )

      const effect = await this.buildEffectPositionRollback(input, transfer, errorApi)
      return this.handleNext({
        type: PaymentFulfilResultType.PASS,
        effects: [effect],
      })
    }

    assert(
      payload.transferState === 'COMMITTED' ||
      payload.transferState === 'RESERVED' ||
      payload.transferState === 'RESERVED_FORWARDED'
    )
    if (transfer.expirationDate <= new Date(Util.Time.getUTCString(new Date()))) {
      return {
        type: PaymentFulfilResultType.FAIL_VALIDATION,
        effects: [],
        error: ErrorHandler.Factory.createInternalServerFSPIOPError(
          `transfer timed out.`
        )
      }
    }

    await saveTransferFulfilmentDuplicateCheck(transferId, payloadHash)
    if (!TransferHelper.fulfilmentMatchesCondition(payload.fulfilment, transfer.condition)) {
      // Payee sent an fulfilment. Need to abort the payment.
      const errorFspiop = ErrorHandler.Factory.createInternalServerFSPIOPError(
        `fulfilment does not match condition.`
      )
      const error = errorFspiop.toApiErrorObject(this.deps.config.ERROR_HANDLING)
      // Transfer aborted.
      await TransferService.handlePayeeResponse(
        transferId,
        payload,
        'abort-validation',
        error
      )

      const effect = await this.buildEffectPositionRollback(input, transfer, error)
      return this.handleNext({
        type: PaymentFulfilResultType.FAIL_VALIDATION,
        effects: [effect],
        error
      })
    }

    // Happy path - validation passed.
    await TransferService.handlePayeeResponse(transferId, payload, input.action)

    // Build the position change effect.
    const messageEffect = input.message
    const cyrilResult = await this.deps.fxService.Cyril.processFulfilMessage(
      input.transferId,
      input.payload,
      transfer
    )
    let messageKey: string
    if (cyrilResult.isFx && cyrilResult.positionChanges.length > 0) {
      // Forex + Payment.
      // @ts-ignore
      messageKey = cyrilResult.positionChanges[0].participantCurrencyId.toString()
      messageEffect.value.content.context = {
        ...messageEffect.value.content.context,
        cyrilResult
      }
    } else {
      // Standalone Payment.
      const payeeAccount = await Participant.getAccountByNameAndCurrency(
        transfer.payeeFsp, transfer.currency, Enum.Accounts.LedgerAccountType.POSITION,
      )
      messageKey = payeeAccount.participantCurrencyId.toString()
    }

    assert(messageKey)

    const effectPosition: Effect = {
      functionality: Type.POSITION,
      action: Action.COMMIT,
      message: messageEffect.value,
      messageKey,
      topicName: 'topic-transfer-position-batch',
      status: 'SUCCESS'
    }

    return this.handleNext({
      type: PaymentFulfilResultType.PASS,
      effects: [effectPosition],
    })
  }

  /**
   * In UNFUSE mode, returns the result.
   * In FUSE   mode, applies the position change then returns that result.`
   */
  private async handleNext(result: PaymentFulfilResult): Promise<PaymentFulfilResult> {
    if (this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'UNFUSE') {
      return result
    }

    assert(this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'FUSE')
    const notifications = result.effects
      .filter(effect => effect.functionality === 'notifications')
    const positions = result.effects
      .filter(effect => effect.functionality === 'position')
      .map(MessageBus.effectToKafkaMessage)
    const resultsPosition = await this.deps.positionHandler.handle(null, positions)
    assert(resultsPosition.length > 0, 'Expected at least one result from positionHandler.')
    // Look just at the first one to map the result type.
    const resultPosition = resultsPosition[0]
    const positionEffects = resultsPosition
      .reduce((acc: Array<Effect>, curr) => acc.concat(...curr.effects), [])

    let type: PaymentFulfilResultType
    let error
    switch (resultPosition.type) {
      case PositionResultType.PASS:
        type = PaymentFulfilResultType.PASS
        break
      case PositionResultType.FAIL_LIQUIDITY:
        type = PaymentFulfilResultType.FAIL_OTHER
        error = resultPosition.error
        break
      case PositionResultType.FAIL_OTHER:
        type = PaymentFulfilResultType.FAIL_OTHER
        error = resultPosition.error
        break
    }

    return {
      type,
      effects: [...notifications, ...positionEffects],
      error,
    }
  }

  private extractMessageData(message: any): FusedFulfilHandlerInput {
    assertNestedFields(message, 'value.metadata.event')

    const payloadEncoded = message.value.content.payload
    const payload = decodePayload(payloadEncoded, {}) as CommitPaymentDto
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

    assert(message.value.content.uriParams)
    assert(message.value.content.uriParams.id)
    const transferId = message.value.content.uriParams.id
    assert(transferId, 'could not parse transferId')

    const actionStr = message.value.metadata.event.action
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

  private async buildEffectPositionRollback(
    input: FusedFulfilHandlerInput,
    transfer: any,
    error: {
      errorInformation: {
        errorCode: string,
        errorDescription: string,
      }
    }
  ): Promise<Effect> {
    const cyrilResult = await this.deps.fxService.Cyril.processAbortMessage(input.transferId)
    // If a payment has a linked forex, we first set its state to RECEIVED_ERROR otherwise the
    // position handler ignores the position reset.
    for (const positionChange of cyrilResult.positionChanges) {
      if (positionChange.isFxTransferStateChange) {
        await this.deps.fxService.handleFulfilResponse(
          positionChange.commitRequestId,
          error,
          Action.FX_ABORT,
          error
        )
      }
    }

    const message = structuredClone(input.message.value)
    message.content.payload = error
    message.content.context = {
      ...message.content.context,
      cyrilResult
    }

    let messageKey: string
    if (cyrilResult.positionChanges.length > 0) {
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
    return {
      functionality: Type.POSITION,
      action: Action.ABORT,
      message,
      messageKey,
      topicName: 'topic-transfer-position-batch',
      status: 'FAILURE',
      fspiopError: error
    }
  }
}
