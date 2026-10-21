import assert from "node:assert";
import { TimedOutTransfer } from "../../../models/transfer/facade";
import { Enum, Util } from '@mojaloop/central-services-shared';
const { TransferState } = Enum.Transfers
import {
  FulfilHandlerInput
} from '../../../handlers/payment-fulfil';
import {
  PrepareHandlerInput
} from "../../../handlers/payment-prepare";
import {
  TransferDeterminingCheckResult,
  TransferProxyObligation
} from "../../../handlers/transfer-types";
import { ApplicationConfig } from "../../../lib/config";
import { Effect } from "../../../messaging/message-bus";
import {
  LegacyLedgerAccount
} from "../shared/types";
const fxService = require('../../fx')

import { TimeoutResultPayment, TimeoutResultPaymentForward } from '../../../handlers/timeout-v2';
import {
  ForwardedFxTransfer,
  ForwardedTransfer,
  TimedOutFxTransfer,
} from '../../../models/transfer/facade';
import * as Participant from '../../participant';
import TransferObjectTransform from '../../transfer/transform';
const { Type, Action } = Enum.Events.Event
const { Comparators, resourceVersions } = Util

const ErrorHandler = require('@mojaloop/central-services-error-handling')



interface Dependencies {
  randomBytes: (length: number) => Buffer,
  config: ApplicationConfig
}

export default class Helper {
  private readonly timeoutError
  
  constructor(private deps: Dependencies) {
    assert(deps.randomBytes)
    assert(deps.config)

    this.timeoutError = ErrorHandler.Factory
      .createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED)
      .toApiErrorObject(this.deps.config.ERROR_HANDLING)
  }

  /**
   * Create a random bigint id within Number.MAX_SAFE_INTEGER (53 bits).
   * 
   * TigerBeetle Accounts can be 128 bits, but since the Admin API uses javascript/json numbers
   * to maintain backwards compatibility, we generate our own random accountIds under 
   * Number.MAX_SAFE_INTEGER to be safe.
   */
  public idSmall(): bigint {
    const bytes = this.deps.randomBytes(8)
    const value = bytes.readBigUInt64BE();
    return value & 0x1FFFFFFFFFFFFFn;
  }

  // Backwards compatibility, sort by createdDate, then Currency, then ledgerAccountType.
  public static dfspAccountComparator(a: LegacyLedgerAccount, b: LegacyLedgerAccount): number {
    if (a.createdDate.getTime() === b.createdDate.getTime()) {
      return `${a.currency}_${a.ledgerAccountType}`.localeCompare(`${b.currency}_${b.ledgerAccountType}`)
    }

    return a.createdDate.getTime() - b.createdDate.getTime()
  }

  public static successEmpty() {
    return {
      type: 'SUCCESS' as 'SUCCESS'
    }
  }

  public static failure(error: any) {
    return {
      type: "FAILURE" as 'FAILURE',
      error
    }
  }

  public buildEffectPosition(
    input: PrepareHandlerInput,
    messageKey: string,
    cyrilResult: any
  ): Effect {
    const messageEffect = structuredClone(input.message)
    messageEffect.value.content.context = {
      ...messageEffect.value.content.context,
      cyrilResult
    }
    const effectPosition: Effect = {
      functionality: Type.POSITION,
      action: Action.PREPARE,
      message: messageEffect.value,
      messageKey,
      topicName: 'topic-transfer-position-batch',
      status: 'SUCCESS',
    }
    return effectPosition
  }

  public buildEffectNotificationError(
    input: PrepareHandlerInput,
    fspiopError: any
  ): Effect {
    const message = structuredClone(input.message.value)
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)

    message.content.payload = apiFSPIOPError
    message.content.uriParams = { id: input.payload.transferId }
    message.to = message.from
    message.from = this.deps.config.HUB_NAME
    if (message.content.headers) {
      message.content.headers['fspiop-source'] = message.from
      message.content.headers['fspiop-destination'] = message.to
    }

    const effect: Effect = {
      functionality: Type.NOTIFICATION,
      action: Action.PREPARE,
      message,
      topicName: 'topic-notification-event',
      status: 'FAILURE',
      fspiopError: apiFSPIOPError
    }
    return effect
  }

  public buildEffectNotificationDuplicate(
    input: PrepareHandlerInput,
    transfer: any
  ): Effect {
    const message = structuredClone(input.message.value)
    message.content.payload = TransferObjectTransform.toFulfil(transfer, false)
    message.content.uriParams = { id: input.payload.transferId }

    message.to = message.from
    message.from = this.deps.config.HUB_NAME
    if (message.content.headers) {
      message.content.headers['fspiop-source'] = message.from
      message.content.headers['fspiop-destination'] = message.to
    }

    return {
      functionality: Type.NOTIFICATION,
      action: Action.PREPARE_DUPLICATE,
      message,
      topicName: 'topic-notification-event',
      status: 'SUCCESS',
    }
  }

  public buildEffectFulfilDuplicateNotification(
    input: FulfilHandlerInput,
    transfer: any,
    isTransferError: boolean
  ): Effect {
    const message = structuredClone(input.message.value)
    message.content.payload = TransferObjectTransform.toFulfil(transfer, false)
    message.content.uriParams = { id: input.transferId }

    message.to = message.from
    message.from = this.deps.config.HUB_NAME
    if (message.content.headers) {
      message.content.headers['fspiop-source'] = message.from
      message.content.headers['fspiop-destination'] = message.to
    }

    return {
      functionality: Type.NOTIFICATION,
      action: isTransferError ? Action.ABORT_DUPLICATE : Action.FULFIL_DUPLICATE,
      message,
      topicName: 'topic-notification-event',
      status: 'SUCCESS',
    }
  }

  public buildEffectFulfilDuplicateError(
    input: FulfilHandlerInput,
    fspiopError: any,
    isTransferError: boolean
  ): Effect {
    const message = structuredClone(input.message.value)
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)
    message.content.payload = apiFSPIOPError
    message.content.uriParams = { id: input.transferId }

    message.to = message.from
    message.from = this.deps.config.HUB_NAME
    if (message.content.headers) {
      message.content.headers['fspiop-source'] = message.from
      message.content.headers['fspiop-destination'] = message.to
    }

    return {
      functionality: Type.NOTIFICATION,
      action: isTransferError ? Action.ABORT_DUPLICATE : Action.FULFIL_DUPLICATE,
      message,
      topicName: 'topic-notification-event',
      status: 'FAILURE',
      fspiopError: apiFSPIOPError
    }
  }

  // TODO: make non-async.
  public async buildEffectPositionRollback(
    input: FulfilHandlerInput,
    transfer: any,
    error: {
      errorInformation: {
        errorCode: string,
        errorDescription: string,
      }
    },
    /**
     * If true, will use action=ABORT_VALIDATION, otherwise ABORT.
     */
    isValidationFailure: boolean = true
  ): Promise<Effect> {
    const cyrilResult = await fxService.Cyril.processAbortMessage(input.transferId)
    // If a payment has a linked forex, we first set its state to RECEIVED_ERROR otherwise the
    // position handler ignores the position reset.
    for (const positionChange of cyrilResult.positionChanges) {
      if (positionChange.isFxTransferStateChange) {
        await fxService.handleFulfilResponse(
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
    const action = isValidationFailure ? Action.ABORT_VALIDATION : Action.ABORT
    return {
      functionality: Type.POSITION,
      action,
      message,
      messageKey,
      topicName: 'topic-transfer-position-batch',
      status: 'FAILURE',
      fspiopError: error
    }
  }

  public buildEffectReservedAbortedNotification(
    input: FulfilHandlerInput,
    transfer: any
  ): Effect {
    const message = structuredClone(input.message.value)
    message.content.payload = {
      transferId: transfer.transferId,
      completedTimestamp: new Date().toISOString(),
      transferState: TransferState.ABORTED
    }
    message.content.uriParams = { id: input.transferId }

    message.to = transfer.payeeFsp
    message.from = this.deps.config.HUB_NAME
    if (message.content.headers) {
      message.content.headers['fspiop-source'] = message.from
      message.content.headers['fspiop-destination'] = message.to
    }

    return {
      functionality: Type.NOTIFICATION,
      action: Action.RESERVED_ABORTED,
      message,
      topicName: 'topic-notification-event',
      status: 'SUCCESS',
    }
  }

  /**
   * Iterate through all of the timed out payments, and emit notification and position effects.
   */
  public paymentEffects(payments: Array<TimedOutTransfer>):
    Array<TimeoutResultPayment> {
    return payments.map(payment => {
      if (payment.bulkTransferId) {
        throw new Error('TimeoutHandlerV2 - timeouts for bulk transfers not yet supported.')
      }

      switch (payment.transferStateId) {
        // Payment expired _before_ the position was reserved.
        case 'EXPIRED_PREPARED': {
          return {
            context: payment,
            effect: this.buildEffectPaymentTimeoutNotification(payment)
          }
        }
        // Payment expired _after_ the position was reserved.
        case 'RESERVED_TIMEOUT':
          return {
            context: payment,
            effect: this.buildEffectPaymentPositionTimeout(payment)
          }
        default: {
          throw new Error(`timeoutPaymentEffects - unhandled transferStateId: ${payment.transferStateId}`)
        }
      }
    })
  }

  public forexEffects(forexes: Array<TimedOutFxTransfer>):
    Array<TimeoutResultPayment> {
    return forexes.map(forex => {
      switch (forex.transferStateId) {
        // Payment expired _before_ the position was reserved.
        case 'EXPIRED_PREPARED': {
          return {
            context: forex,
            effect: this.buildEffectForexTimeoutNotification(forex)
          }
        }
        // Payment expired _after_ the position was reserved.
        case 'RESERVED_TIMEOUT':
          return {
            context: forex,
            effect: this.buildEffectForexPositionTimeout(forex)
          }
        default: {
          throw new Error(`timeoutForexEffects - unhandled transferStateId: ${forex.transferStateId}`)
        }
      }
    })
  }

  public forwardedPaymentEffects(payments: Array<ForwardedTransfer>):
    Array<TimeoutResultPaymentForward> {
    return payments.map(payment => {
      const effect: Effect = {
        functionality: Type.NOTIFICATION,
        action: Action.GET,
        message: this.buildForwardedPaymentMessage(payment),
        topicName: 'topic-notification-event',
        status: 'FAILURE',
        fspiopError: this.timeoutError
      }

      return {
        context: payment,
        effect,
      }
    })
  }

  public forwardedForexEffects(forexes: Array<ForwardedFxTransfer>):
    Array<TimeoutResultPaymentForward> {
    return forexes.map(forex => {
      const effect: Effect = {
        functionality: Type.NOTIFICATION,
        action: Action.GET,
        message: this.buildForwardedForexMessage(forex),
        topicName: 'topic-notification-event',
        status: 'FAILURE',
        fspiopError: this.timeoutError
      }

      return {
        context: forex,
        effect,
      }
    })
  }

  public buildEffectPaymentTimeoutNotification(payment: TimedOutTransfer): Effect {
    const effect: Effect = {
      functionality: Type.NOTIFICATION,
      action: Action.TIMEOUT_RECEIVED,
      message: this.buildTimeoutMessagePayment(payment),
      topicName: 'topic-notification-event',
      status: 'FAILURE',
      fspiopError: this.timeoutError
    }

    return effect
  }

  public buildEffectPaymentPositionTimeout(payment: TimedOutTransfer): Effect {
    return {
      functionality: Type.POSITION,
      action: Action.TIMEOUT_RESERVED,
      message: this.buildTimeoutMessagePayment(payment),
      messageKey: payment.effectedParticipantCurrencyId.toString(),
      topicName: 'topic-transfer-position-batch',
      status: 'FAILURE',
      fspiopError: this.timeoutError
    }
  }

  public buildEffectForexTimeoutNotification(forex: TimedOutFxTransfer): Effect {
    const effect: Effect = {
      functionality: Type.NOTIFICATION,
      action: Action.FX_TIMEOUT_RECEIVED,
      message: this.buildForexTimeoutMessage(forex),
      topicName: 'topic-notification-event',
      status: 'FAILURE',
      fspiopError: this.timeoutError
    }

    return effect
  }

  public buildEffectForexPositionTimeout(forex: TimedOutFxTransfer): Effect {
    return {
      functionality: Type.POSITION,
      action: Action.FX_TIMEOUT_RESERVED,
      message: this.buildForexTimeoutMessage(forex),
      messageKey: forex.effectedParticipantCurrencyId.toString(),
      topicName: 'topic-transfer-position-batch',
      status: 'FAILURE',
      fspiopError: this.timeoutError
    }
  }

  public buildTimeoutMessagePayment(payment: TimedOutTransfer) {
    const destination = payment.externalPayerName || payment.payerFsp
    const source = payment.externalPayeeName || payment.payeeFsp
    const transfersResource = Enum.Http.HeaderResources.TRANSFERS
    const contentVersion = resourceVersions[transfersResource].contentVersion

    const state = Util.StreamingProtocol.createEventState(
      Enum.Events.EventStatus.FAILURE.status,
      this.timeoutError.errorInformation.errorCode,
      this.timeoutError.errorInformation.errorDescription
    )
    const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(
      payment.transferId,
      Enum.Kafka.Topics.NOTIFICATION,
      Action.TIMEOUT_RECEIVED,
      state
    )
    const headers = Util.Http.SwitchDefaultHeaders(
      destination, transfersResource, this.deps.config.HUB_NAME, contentVersion
    )
    const message = Util.StreamingProtocol.createMessage(
      payment.transferId,
      destination,
      source,
      metadata,
      headers,
      this.timeoutError,
      { id: payment.transferId },
      `application/vnd.interoperability.${transfersResource}+json;version=${contentVersion}`
    )
    message.from = this.deps.config.HUB_NAME
    message.content.context = {
      payer: payment.externalPayerName || payment.payerFsp,
      payee: payment.externalPayeeName || payment.payeeFsp
    }

    return message
  }

  public buildForexTimeoutMessage(forex: TimedOutFxTransfer) {
    const destination = forex.externalInitiatingFspName || forex.initiatingFsp
    const source = forex.externalCounterPartyFspName || forex.counterPartyFsp
    const fxTransfersResource = Enum.Http.HeaderResources.FX_TRANSFERS
    const contentVersion = resourceVersions[fxTransfersResource].contentVersion

    const state = Util.StreamingProtocol.createEventState(
      Enum.Events.EventStatus.FAILURE.status,
      this.timeoutError.errorInformation.errorCode,
      this.timeoutError.errorInformation.errorDescription
    )
    const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(
      forex.commitRequestId,
      Enum.Kafka.Topics.NOTIFICATION,
      Action.FX_TIMEOUT_RECEIVED,
      state
    )
    const headers = Util.Http.SwitchDefaultHeaders(
      destination, fxTransfersResource, this.deps.config.HUB_NAME, contentVersion
    )
    const message = Util.StreamingProtocol.createMessage(
      forex.commitRequestId,
      destination,
      source,
      metadata,
      headers,
      this.timeoutError,
      { id: forex.commitRequestId },
      `application/vnd.interoperability.${fxTransfersResource}+json;version=${contentVersion}`
    )
    message.from = this.deps.config.HUB_NAME
    message.content.context = {
      payer: forex.externalInitiatingFspName || forex.initiatingFsp,
      payee: forex.externalCounterPartyFspName || forex.counterPartyFsp
    }

    return message
  }

  public buildForwardedPaymentMessage(payment: ForwardedTransfer) {
    const destination = payment.externalPayerName || payment.payeeFsp
    const source = payment.externalPayeeName || payment.payerFsp
    const transfersResource = Enum.Http.HeaderResources.TRANSFERS
    const contentVersion = resourceVersions[transfersResource].contentVersion

    const state = Util.StreamingProtocol.createEventState(
      Enum.Events.EventStatus.FAILURE.status,
      this.timeoutError.errorInformation.errorCode,
      this.timeoutError.errorInformation.errorDescription
    )
    const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(
      payment.transferId,
      Enum.Kafka.Topics.NOTIFICATION,
      Action.GET,
      state
    )
    const headers = Util.Http.SwitchDefaultHeaders(
      destination, transfersResource, source, contentVersion
    )
    const message = Util.StreamingProtocol.createMessage(
      payment.transferId,
      destination,
      source,
      metadata,
      headers,
      null,
      { id: payment.transferId },
      `application/vnd.interoperability.${transfersResource}+json;version=${contentVersion}`
    )
    message.from = this.deps.config.HUB_NAME

    return message
  }

  public buildForwardedForexMessage(forex: ForwardedFxTransfer) {
    const destination = forex.externalCounterPartyFspName || forex.counterPartyFsp
    const source = forex.externalInitiatingFspName || forex.initiatingFsp
    const fxTransfersResource = Enum.Http.HeaderResources.FX_TRANSFERS
    const contentVersion = resourceVersions[fxTransfersResource].contentVersion

    const state = Util.StreamingProtocol.createEventState(
      Enum.Events.EventStatus.FAILURE.status,
      this.timeoutError.errorInformation.errorCode,
      this.timeoutError.errorInformation.errorDescription
    )
    const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(
      forex.commitRequestId,
      Enum.Kafka.Topics.NOTIFICATION,
      Action.GET,
      state
    )
    const headers = Util.Http.SwitchDefaultHeaders(
      destination, fxTransfersResource, source, contentVersion
    )
    const message = Util.StreamingProtocol.createMessage(
      forex.commitRequestId,
      destination,
      source,
      metadata,
      headers,
      null,
      { id: forex.commitRequestId },
      `application/vnd.interoperability.${fxTransfersResource}+json;version=${contentVersion}`
    )
    message.from = this.deps.config.HUB_NAME

    return message
  }
}
