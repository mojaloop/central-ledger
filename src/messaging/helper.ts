import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { CommitPaymentDtoAborted, FulfilContextFulfiled, FulfilHandlerInput, PaymentFulfilResult, PaymentFulfilResultTag } from "../handlers/payment-fulfil";
import { PaymentPrepareResult, PaymentPrepareResultTag, PrepareHandlerInput } from "../handlers/payment-prepare";
import { PaymentTimeout, TimeoutResultPayment } from "../handlers/timeout-v2";
import { ApplicationConfig } from "../lib/config";
import { ForwardedFxTransfer, ForwardedTransfer, TimedOutFxTransfer } from "../models/transfer/facade";
import { Effect } from "./message-bus";

const { Enum, Util } = require('@mojaloop/central-services-shared')
const { StreamingProtocol, resourceVersions } = Util
const { Type, Action } = Enum.Events.Event
const ErrorHandler = require('@mojaloop/central-services-error-handling')

interface Dependencies {
  config: ApplicationConfig,
  randomUUID?: () => string,
}

export default class MessagingHelper {
  private config: ApplicationConfig
  private readonly timeoutError


  constructor(private deps: Dependencies) {
    this.config = deps.config

    this.timeoutError = ErrorHandler.Factory
      .createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED)
      .toApiErrorObject(this.deps.config.ERROR_HANDLING)
  }

  public effectToKafkaMessage(effect: Effect) {
    const { functionality, action, message, messageKey, status, fspiopError } = effect
    const eventStatus = Enum.Events.EventStatus[status]
    const messageProtocol = StreamingProtocol.updateMessageProtocolMetadata(
      message, functionality, action, eventStatus
    )

    if (fspiopError) {
      messageProtocol.content.payload = fspiopError
    }

    // Override the metadata.event.id to something we can deterministically control in our context.
    if (messageProtocol.metadata.event.id) {
      messageProtocol.metadata.event.id = this.randomUUID()
    }

    return {
      key: messageKey,
      value: messageProtocol
    }
  }

  public buildEffectsPrepare(result: PaymentPrepareResult): Array<Effect> {
    // Shortcut.
    const input = result.input
    switch (result.tag) {
      case PaymentPrepareResultTag.FAIL_VALIDATION: {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          result.failureReasons.join(', ')
        )
        return [this.buildEffectPrepareNotificationError(input, fspiopError)]
      }
      case PaymentPrepareResultTag.MODIFIED: {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST
        )
        return [this.buildEffectPrepareNotificationError(input, fspiopError)]
      }
      case PaymentPrepareResultTag.DUPLICATE_FINAL: {
        return [this.buildEffectPrepareNotificationDuplicate(input, result.context)]
      }
      case PaymentPrepareResultTag.DUPLICATE_NON_FINAL: return []
      case PaymentPrepareResultTag.FAIL_ACCOUNT_CLOSED: {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          'Account closed'
        )
        return [this.buildEffectPrepareNotificationError(input, fspiopError)]
      }
      case PaymentPrepareResultTag.FAIL_LIQUIDITY: {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_INSUFFICIENT_LIQUIDITY
        )
        return [this.buildEffectPrepareNotificationErrorLiquidity(input, fspiopError)]
      }
      case PaymentPrepareResultTag.FAIL_OTHER: {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR
        )
        return [this.buildEffectPrepareNotificationError(input, fspiopError)]
      }
      // Special case for UNFUSE handler. We need to emit a prepare position message.
      case PaymentPrepareResultTag.PREPARE_NEXT: return [result.effectPosition]
      case PaymentPrepareResultTag.OK: return [
        this.buildEffectPrepareNotificationSuccess(input)
      ]
      default: {
        const _exhaustive: never = result
        throw new Error(`Unhandled result tag: ${(_exhaustive as PaymentPrepareResult).tag}`)
      }
    }
  }

  public buildEffectsFulfil(result: PaymentFulfilResult): Array<Effect> {
    // Shortcut.
    const input = result.input
    switch (result.tag) {
      case PaymentFulfilResultTag.FAIL_VALIDATION: {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          result.failureReasons.join(', ')
        )
        return [this.buildEffectFulfilNotificationError(input, fspiopError)]
      }
      case PaymentFulfilResultTag.EXPIRED: {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED
        )
        return [this.buildEffectFulfilNotificationError(input, fspiopError)]
      }
      case PaymentFulfilResultTag.INVALID_FULFILMENT: {
        const errorFspiop = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          'invalid fulfilment'
        )

        return [this.buildEffectFulfilNotificationError(input, errorFspiop)]
      }
      case PaymentFulfilResultTag.MODIFIED: {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST
        )
        return [this.buildEffectFulfilNotificationError(input, fspiopError)]
      }
      case PaymentFulfilResultTag.DUPLICATE_FINAL: {
        return [this.buildEffectFulfilDuplicate(input, result.context as FulfilContextFulfiled)]
      }
      case PaymentFulfilResultTag.DUPLICATE_NON_FINAL: return []


      case PaymentFulfilResultTag.FAIL_OTHER: {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR
        )
        return [this.buildEffectFulfilNotificationError(input, fspiopError)]
      }
      // Special case for UNFUSE handler. We need to emit a fulfil position + notification message.
      case PaymentFulfilResultTag.FULFIL_NEXT: return result.effects

      case PaymentFulfilResultTag.ABORT_OK: {
        const payload = input.payload as CommitPaymentDtoAborted
        const fspiopError = ErrorHandler.Factory.createFSPIOPErrorFromErrorInformation(
          payload.errorInformation
        )
        return [this.buildEffectAbortNotification(input, fspiopError)]
      }
      case PaymentFulfilResultTag.OK: {
        const effects = [
          this.buildEffectFulfilNotificationSuccess(input, result.context as FulfilContextFulfiled),
        ]
        // We need to adjust buildEffectNotificationSuccess, to include the linked Payment context.
        if (result.fxEffect) effects.push(result.fxEffect)
        return effects
      }
      default: {
        const _exhaustive: never = result
        throw new Error(`Unhandled result tag: ${(_exhaustive as PaymentPrepareResult).tag}`)
      }
    }
  }

  public buildEffectFulfilNotificationError(
    input: FulfilHandlerInput,
    fspiopError: any
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
      action: input.action,
      message,
      topicName: 'topic-notification-event',
      status: 'FAILURE',
      fspiopError: apiFSPIOPError
    }
  }

  public buildEffectAbortNotification(
    input: FulfilHandlerInput,
    fspiopError: any
  ): Effect {
    const message = structuredClone(input.message.value)
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.deps.config.ERROR_HANDLING)

    message.content.payload = apiFSPIOPError
    message.content.uriParams = { id: input.transferId }
    message.to = input.destinationDfspId
    message.from = input.callerDfspId
    if (message.content.headers) {
      message.content.headers['fspiop-source'] = message.from
      message.content.headers['fspiop-destination'] = message.to
    }

    return {
      functionality: Type.NOTIFICATION,
      action: input.action,
      message,
      topicName: 'topic-notification-event',
      status: 'FAILURE',
      fspiopError: apiFSPIOPError
    }
  }

  public buildEffectFulfilDuplicate(input: FulfilHandlerInput, context: FulfilContextFulfiled): Effect {
    const message = structuredClone(input.message.value)
    message.content.uriParams = { id: input.transferId }

    message.to = message.from
    message.from = this.deps.config.HUB_NAME
    if (message.content.headers) {
      message.content.headers['fspiop-source'] = message.from
      message.content.headers['fspiop-destination'] = message.to
    }

    // Override the message.content.payload.completedTimestamp with the date of the original.
    message.content.payload = {
      transferState: 'COMMITTED',
      fulfilment: context.fulfilment,
      completedTimestamp: context.fulfiledAt,
    }

    return {
      functionality: Type.NOTIFICATION,
      action: Action.FULFIL_DUPLICATE,
      message,
      topicName: 'topic-notification-event',
      status: 'SUCCESS',
    }
  }

  public buildEffectFulfilNotificationSuccess(
    input: FulfilHandlerInput,
    context: FulfilContextFulfiled,
  ): Effect {
    assert(context)
    assert(context.fulfiledAt)
    assert(context.fulfilment)

    const message = {
      id: input.transferId,
      type: 'application/json',
      content: {
        uriParams: { id: input.transferId },
        headers: { ...input.message.value.content.headers },
        payload: {
          transferState: 'COMMITTED',
          fulfilment: context.fulfilment,
          completedTimestamp: context.fulfiledAt
        }
      },
      metadata: {
        correlationId: input.transferId,
        event: {
          type: Type.TRANSFER,
          action: 'commit',
          createdAt: new Date().toISOString(),
          state: {
            status: 'success',
            code: null,
            description: null
          }
        }
      }
    }

    return {
      functionality: Type.NOTIFICATION,
      action: input.action,
      message,
      topicName: 'topic-notification-event',
      status: 'SUCCESS',
    }
  }

  private buildEffectPrepareNotificationError(
    input: PrepareHandlerInput,
    fspiopError: any
  ): Effect {
    const message = structuredClone(input.message.value)
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.config.ERROR_HANDLING)

    message.content.payload = apiFSPIOPError
    message.content.uriParams = { id: input.payload.transferId }
    message.to = message.from
    message.from = this.config.HUB_NAME
    if (message.content.headers) {
      message.content.headers['fspiop-source'] = message.from
      message.content.headers['fspiop-destination'] = message.to
    }

    return {
      functionality: Type.NOTIFICATION,
      action: Action.PREPARE,
      message,
      topicName: 'topic-notification-event',
      status: 'FAILURE',
      fspiopError: apiFSPIOPError
    }
  }

  private buildEffectPrepareNotificationErrorLiquidity(
    input: PrepareHandlerInput,
    fspiopError: any
  ): Effect {
    const apiFSPIOPError = fspiopError.toApiErrorObject(this.config.ERROR_HANDLING)

    const headers = { ...input.message.value.content.headers }
    headers['fspiop-destination'] = input.payload.payerFsp
    headers['fspiop-source'] = this.config.HUB_NAME
    delete headers['content-length']

    const state = StreamingProtocol.createEventState(
      Enum.Events.EventStatus.FAILURE.status,
      apiFSPIOPError.errorInformation.errorCode,
      apiFSPIOPError.errorInformation.errorDescription
    )

    const metadata = StreamingProtocol.createMetadataWithCorrelatedEvent(
      input.payload.transferId,
      Enum.Kafka.Topics.NOTIFICATION,
      Action.PREPARE,
      state
    )

    const message = StreamingProtocol.createMessage(
      input.payload.transferId,
      input.payload.payerFsp,
      this.config.HUB_NAME,
      metadata,
      headers,
      apiFSPIOPError,
      { id: input.payload.transferId },
      'application/json',
    )

    return {
      functionality: Type.NOTIFICATION,
      action: Action.PREPARE,
      message,
      topicName: 'topic-notification-event',
      status: 'FAILURE',
    }
  }

  private buildEffectPrepareNotificationDuplicate(
    input: PrepareHandlerInput,
    payload: any
  ): Effect {
    const message = structuredClone(input.message.value)
    message.content.payload = payload
    message.content.uriParams = { id: input.payload.transferId }

    message.to = message.from
    message.from = this.config.HUB_NAME
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

  public buildEffectPrepareNotificationSuccess(
    input: PrepareHandlerInput
  ): Effect {
    const headers = { ...input.message.value.content.headers }
    delete headers['content-length']

    const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(
      input.payload.transferId,
      Enum.Kafka.Topics.TRANSFER,
      Action.PREPARE,
      {
        status: 'success',
        code: null,
        description: null,
      }
    )

    const message = Util.StreamingProtocol.createMessage(
      input.payload.transferId,
      input.payload.payeeFsp,
      input.payload.payerFsp,
      metadata,
      headers,
      input.payload,
      {},
      'application/json',
    )

    const effect: Effect = {
      functionality: Type.NOTIFICATION,
      action: Action.PREPARE,
      message,
      topicName: 'topic-notification-event',
      status: 'SUCCESS',
    }
    return effect
  }

  public buildEffectsTimedOutPayments(payments: Array<PaymentTimeout>):
    Array<TimeoutResultPayment> {
    return payments.map(payment => {
      switch (payment.state) {
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
          throw new Error(`timeoutPaymentEffects - unhandled transferStateId: ${payment.state}`)
        }
      }
    })
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

  public buildEffectPaymentTimeoutNotification(payment: PaymentTimeout): Effect {
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

  public buildEffectPaymentPositionTimeout(payment: PaymentTimeout): Effect {
    return {
      functionality: Type.POSITION,
      action: Action.TIMEOUT_RESERVED,
      message: this.buildTimeoutMessagePayment(payment),
      topicName: 'topic-transfer-position-batch',
      status: 'FAILURE',
      fspiopError: this.timeoutError
    }
  }

  public buildTimeoutMessagePayment(payment: PaymentTimeout) {
    const destination = payment.payerId
    const source = payment.payeeId
    const transfersResource = Enum.Http.HeaderResources.TRANSFERS
    const contentVersion = resourceVersions[transfersResource].contentVersion

    const state = Util.StreamingProtocol.createEventState(
      Enum.Events.EventStatus.FAILURE.status,
      this.timeoutError.errorInformation.errorCode,
      this.timeoutError.errorInformation.errorDescription
    )
    const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(
      payment.id,
      Enum.Kafka.Topics.NOTIFICATION,
      Action.TIMEOUT_RECEIVED,
      state
    )
    const headers = Util.Http.SwitchDefaultHeaders(
      destination, transfersResource, this.deps.config.HUB_NAME, contentVersion
    )
    const message = Util.StreamingProtocol.createMessage(
      payment.id,
      destination,
      source,
      metadata,
      headers,
      this.timeoutError,
      { id: payment.id },
      `application/vnd.interoperability.${transfersResource}+json;version=${contentVersion}`
    )
    message.from = this.deps.config.HUB_NAME
    message.content.context = {
      payer: payment.payerId,
      payee: payment.payeeId
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

  private randomUUID(): string {
    if (!this.deps.randomUUID) return randomUUID()
    return this.deps.randomUUID()
  }
}
