

import { ApplicationConfig } from "../lib/config";

import TimeoutService from '../domain/timeout';
import { ForwardedFxTransfer, ForwardedTransfer, TimedOutFxTransfer, TimedOutTransfer } from "../models/transfer/facade";
import { Effect } from "../messaging/message-bus";
import db from "../lib/db";

import { Enum, Util } from '@mojaloop/central-services-shared'
import { Knex } from "knex";
import { logger } from "../shared/logger";
import assert from "node:assert";
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { Type, Action } = Enum.Events.Event
const { resourceVersions } = Util

export type TimeoutResultPayment = {
  context: any,
  effect: Effect
}

export type TimeoutResultForex = {
  context: any,
  effect: Effect
}

export type TimeoutResultPaymentForward = {
  context: any,
  effect: Effect
}

export type TimeoutResultForexForward = {
  context: any,
  effect: Effect
}

export type TimeoutResult = {
  intervalPayment: [number, number],
  intervalForex: [number, number],
  results: Array<
    TimeoutResultPayment |
    TimeoutResultForex |
    TimeoutResultPaymentForward |
    TimeoutResultForexForward
  >
}

/**
 * @class TimeoutHandlerV2
 * @description A reimplemented timeout handler which doesn't call Kafka directly,
 *   but returns a list of effects to be emitted by the Messaging layer.
 */
export class TimeoutHandlerV2 {
  // Static error we can use everywhere. It doesn't change.
  private readonly timeoutError = ErrorHandler.Factory
    .createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED)
    .toApiErrorObject(this.config.ERROR_HANDLING)


  constructor(private config: ApplicationConfig) { }

  public async run(now: Date): Promise<TimeoutResult> {
    const knex = db.getKnex() as Knex

    // Naive approach - use MySQL named locks to prevent concurrent timeout handlers.
    // If run is called from multiple threads or processes simultaneously, subsequent runs
    // will wait until this lock expires before running.
    // We should tune the sleep time (currently 600 seconds = 10 minutes) based on what's realistic.
    await knex.raw(`SELECT GET_LOCK("timeout_handler", 600)`)

    try {
      const segmentPayment = await TimeoutService.getTimeoutSegmentV2()
      const intervalPaymentMin = segmentPayment.value
      await TimeoutService.cleanupTransferTimeout()
      const intervalPaymentMax = await TimeoutService.getLatestTransferStateChangeV2()
      const segmentForex = await TimeoutService.getFxTimeoutSegmentV2()
      const intervalForexMin = segmentForex.value
      await TimeoutService.cleanupFxTransferTimeout()
      const intervalForexMax = await TimeoutService.getLatestFxTransferStateChangeV2()

      const {
        transferTimeoutList,
        fxTransferTimeoutList
      } = await TimeoutService.timeoutExpireReserved(
        segmentPayment.segmentId, intervalPaymentMin, intervalPaymentMax,
        segmentForex.segmentId, intervalForexMin, intervalForexMax,
        now
      )
      const {
        transferForwardedList,
        fxTransferForwardedList
      } = await TimeoutService.reservedForwardedTransfers(
        intervalPaymentMin, intervalPaymentMax,
        intervalForexMin, intervalForexMax,
        // This was 'config.HANDLERS_TIMEOUT_FORWARDED_MAX_ATTEMPTS' but that doesn't exist.
        // Keeping behavior the same by passing through null.
        null,
        now
      )

      const paymentsResults = await this.paymentEffects(transferTimeoutList)
      const forexResults = await this.forexEffects(fxTransferTimeoutList)
      const forwardedPaymentsResults = await this.forwardedPaymentEffects(transferForwardedList)
      const forwardedForexesResults = await this.forwardedForexEffects(fxTransferForwardedList)
      return {
        intervalPayment: [intervalPaymentMin, intervalPaymentMax],
        intervalForex: [intervalForexMin, intervalForexMax],
        results: [
          ...paymentsResults,
          ...forexResults,
          ...forwardedPaymentsResults,
          ...forwardedForexesResults
        ]
      }
    } catch (err) {
      throw err
    } finally {
      await knex.raw(`SELECT RELEASE_LOCK("timeout_handler")`) 
    }
  }

  /**
   * Iterate through all of the timed out payments, and emit notification and position effects.
   */
  private async paymentEffects(payments: Array<TimedOutTransfer>): 
    Promise<Array<TimeoutResultPayment>> {
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

  private async forexEffects(forexes: Array<TimedOutFxTransfer>):
    Promise<Array<TimeoutResultPayment>> {
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

  private async forwardedPaymentEffects(payments: Array<ForwardedTransfer>):
    Promise<Array<TimeoutResultPaymentForward>> {
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

  private async forwardedForexEffects(forexes: Array<ForwardedFxTransfer>):
    Promise<Array<TimeoutResultPaymentForward>> {
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

  private buildEffectPaymentTimeoutNotification(payment: TimedOutTransfer): Effect {
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

  private buildEffectPaymentPositionTimeout(payment: TimedOutTransfer): Effect {
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

  private buildEffectForexTimeoutNotification(forex: TimedOutFxTransfer): Effect {
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

  private buildEffectForexPositionTimeout(forex: TimedOutFxTransfer): Effect {
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

  private buildTimeoutMessagePayment(payment: TimedOutTransfer) {
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
      destination, transfersResource, this.config.HUB_NAME, contentVersion
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
    message.from = this.config.HUB_NAME
    message.content.context = {
      payer: payment.externalPayerName || payment.payerFsp,
      payee: payment.externalPayeeName || payment.payeeFsp
    }

    return message
  }

  private buildForexTimeoutMessage(forex: TimedOutFxTransfer) {
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
      destination, fxTransfersResource, this.config.HUB_NAME, contentVersion
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
    message.from = this.config.HUB_NAME
    message.content.context = {
      payer: forex.externalInitiatingFspName || forex.initiatingFsp,
      payee: forex.externalCounterPartyFspName || forex.counterPartyFsp
    }

    return message
  }

  private buildForwardedPaymentMessage(payment: ForwardedTransfer) {
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
    message.from = this.config.HUB_NAME

    return message
  }

  private buildForwardedForexMessage(forex: ForwardedFxTransfer) {
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
    message.from = this.config.HUB_NAME

    return message
  }
}