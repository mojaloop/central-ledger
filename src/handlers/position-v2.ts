import assert from "node:assert"
import { ApplicationConfig } from "../lib/config"
import { Effect } from "../messaging/message-bus"
import { logger } from "../shared/logger"
import { assertNestedFields } from "../lib/config/util"
const decodePayload = require('@mojaloop/central-services-shared').Util.StreamingProtocol.decodePayload

const BatchPositionModel = require('../models/position/batch')
import BinProcessor from '../domain/position/binProcessor'

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { FSPIOPError } = ErrorHandler

export enum PositionResultType {
  /**
   * Prepare step completed validation.
   */
  PASS = 'PASS',

  /**
   * Position change failed as payee didn't have enough liquidity.
   */
  FAIL_LIQUIDITY = 'FAIL_LIQUIDITY',

  /**
   * Catch-all position failed for another reason.
   */
  FAIL_OTHER = 'FAIL_OTHER',
}

export type PositionResult = {
  type: PositionResultType.PASS,
  effects: Array<Effect>
} | {
  type: PositionResultType.FAIL_LIQUIDITY,
  effects: Array<Effect>,
  error: typeof FSPIOPError
} | {
  type: PositionResultType.FAIL_OTHER,
  effects: Array<Effect>,
  error: typeof FSPIOPError
}

interface BinItem<T = unknown> {
  message: any
  decodedPayload: T
}

type AccountId = string
type Action = string
type Bins = Record<AccountId, Record<Action, Array<BinItem>>>

interface EventMessage {
  id: string
  from: string
  to: string
  type: string
  content: {
    headers: Record<string, string>
    payload: unknown
    uriParams?: { id: string }
    context?: unknown
  }
  metadata: {
    event: {
      id: string
      type: string
      action: string
      createdAt: string
      state: {
        status: string
        code?: number
        description?: string
      }
    }
    correlationId: string
  }
}

interface NotifyMessage {
  binItem: BinItem
  message: EventMessage
}

interface FollowupMessage {
  binItem: BinItem
  messageKey: string  // participantCurrencyId as string
  message: EventMessage
}

interface ParticipantLimit {
  participantId: number
  currencyId: string
  participantLimitTypeId: number
  value: number
  thresholdAlarmPercentage: number
}

interface ProcessBinsResult {
  notifyMessages: Array<NotifyMessage>,
  followupMessages: Array<FollowupMessage>
  limitAlarms: Array<ParticipantLimit>
}

/**
 * @class PositionHandlerV2
 * @description A reimplemented positionHandler which uses the same batching mechanism as
 *   handlerBatch by calling `BinProcessor.processBins()`. This however doesn't call Kafka directly
 *   but returns a list of `effects` for the MessageBus to produce.
 */
export class PositionHandlerV2 {
  constructor(private config: ApplicationConfig) { }

  async handle(error: any, messages: any): Promise<Array<PositionResult>> {
    const recursiveMax = 5
    if (error) {
      throw error
    }

    assert(Array.isArray(messages))
    if (messages.length === 0) {
      logger.debug('PositionHandlerV2.handle() - received empty batch, nothing to process');
      return []
    }

    let trx
    let notifyMessages: Array<NotifyMessage> = []
    let followupMessages: Array<FollowupMessage> = []
    try {
      const bins = this.binMessages(messages)
      trx = await BatchPositionModel.startDbTransaction()
      assert(trx)
      const resultFirst: ProcessBinsResult = await BinProcessor.processBins(bins, trx)
      notifyMessages.push(...resultFirst.notifyMessages)
      followupMessages = resultFirst.followupMessages

      let idx = 0
      while (idx < recursiveMax && followupMessages.length > 0) {
        // Process the followup messages within the same transaction.
        // To match the original implementation, we could commit the first tx and then continue, but
        // this seems better to me.
        const bins = this.binFollowupMessages(followupMessages)
        const resultLoop: ProcessBinsResult = await BinProcessor.processBins(bins, trx)
        notifyMessages.push(...resultLoop.notifyMessages)
        followupMessages = resultLoop.followupMessages

        idx += 1
      }
      if (followupMessages.length > 0) {
        throw new Error(`Maximum recursions reached for processing followupMessages.`)
      }

      // Now we need to 'un-bin' to match the input array.
      const resultsByBinItem: Record<string, {
        binItem: BinItem, notifyMessages: Array<NotifyMessage>
      }> = {}

      for (const notifyMessage of notifyMessages) {
        assert(notifyMessage.message.id)
        const key = notifyMessage.message.id
        if (!resultsByBinItem[key]) {
          resultsByBinItem[key] = { binItem: notifyMessage.binItem, notifyMessages: [] }
        }
        resultsByBinItem[key].notifyMessages.push(notifyMessage)
      }

      const results: Array<PositionResult> = []
      for (const key in resultsByBinItem) {
        const { notifyMessages } = resultsByBinItem[key]
        assert(notifyMessages.length > 0, 'Expected at least one notify message.')
        results.push(this.formatPositionResult(notifyMessages))
      }

      assert(results.length === messages.length, 'Expected results to be the same length as input.')
      await trx.commit()

      return results
    } catch (err: any) {
      logger.error(`handlerBatch failed with error: ${err.message}`)
      logger.error(`stack: ${err.stack}`)

      if (trx) await trx.rollback()

      // It's tricky to know what to do here. If the batch partially failed we don't know which 
      // things actually failed, so we don't know what to respond with.
      // For now, we should just assume everything failed atomically.

      throw new Error(`PositionHandlerV2 failed with error: ${err.message}\n${err.stack}.`)
    }
  }

  private binMessages(messages: Array<any>): Bins {
    const bins: Bins = {}

    for (const message of messages) {
      assert(message.key)
      assertNestedFields(message, 'value.metadata.event.action')
      const accountId = message.key.toString()
      const action = message.value.metadata.event.action

      let accountBin = bins[accountId]
      if (!accountBin) {
        accountBin = {}
        bins[accountId] = accountBin
      }

      let actionBin = accountBin[action]
      if (!actionBin) {
        actionBin = []
        accountBin[action] = actionBin
      }

      actionBin.push({
        message,
        decodedPayload: decodePayload(message.value.content.payload),
      })
    }

    return bins
  }
  
  private binFollowupMessages(messages: Array<FollowupMessage>): Bins {
    const bins: Bins = {}

    for (const followup of messages) {
      assert(followup.messageKey)
      assert(followup.message.metadata.event.action)

      const accountId = followup.messageKey
      const action = followup.message.metadata.event.action
      let accountBin = bins[accountId]
      if (!accountBin) {
        accountBin = {}
        bins[accountId] = accountBin
      }

      let actionBin = accountBin[action]
      if (!actionBin) {
        actionBin = []
        accountBin[action] = actionBin
      }

      actionBin.push({
        message: {
          key: followup.messageKey, value: followup.message
        },
        decodedPayload: followup.message.content.payload
      })
    }

    return bins
  }

  /**
   * Read the contents of the NotifyMessage to imply the PositionResultType.
   */
  private formatPositionResult(notifyMessages: Array<NotifyMessage>) {
    const firstMessage = notifyMessages[0].message
    assert(firstMessage)
    if (firstMessage.metadata.event.state.status === 'success') {
      return {
        type: PositionResultType.PASS as const,
        effects: notifyMessages.map(this.notifyMessageToEffect)
      }
    }

    assertNestedFields(firstMessage, 'content.payload.errorInformation.errorCode')
    // @ts-ignore
    const errorCode = firstMessage.content.payload.errorInformation.errorCode
    // Insufficent liquidity
    if (errorCode === '4001') {
      return {
        type: PositionResultType.FAIL_LIQUIDITY as const,
        effects: notifyMessages.map(this.notifyMessageToEffect),
        error: ErrorHandler.Factory.createFSPIOPErrorFromErrorInformation(
          // @ts-ignore
          firstMessage.content.payload.errorInformation
        )
      }
    }

    return {
      type: PositionResultType.FAIL_OTHER as const,
      effects: notifyMessages.map(this.notifyMessageToEffect),
      error: ErrorHandler.Factory.createFSPIOPErrorFromErrorInformation(
        // @ts-ignore
        firstMessage.content.payload.errorInformation
      )
    }
  }

  /**
   * Map from the BinProcessor representation of a notification to the newer Effect.
   */
  private notifyMessageToEffect(item: NotifyMessage): Effect {
    assertNestedFields(item, 'message.metadata.event.action')
    assertNestedFields(item, 'message.metadata.event.state.status')
    const action = item.message.metadata.event.action
    const status = item.message.metadata.event.state.status

    const extractStatus = (status: string) => {
      switch (status) {
        case 'success': return 'SUCCESS'
        case 'failure': return 'FAILURE'
        case 'error': return 'FAILURE'
        default:
          throw new Error(`extractStatus, unexpected status: ${status}.`)
      }
    }

    const extractAction = (action: string) => {
      switch (action) {
        case 'fx-notify':
        case 'fx-abort':
          return item.message.metadata.event.action
        default:
          assertNestedFields(item, 'binItem.message.value.metadata.event.action')
          return item.binItem.message.value.metadata.event.action
      }
    }

    return {
      functionality: 'position',
      action: extractAction(action),
      message: item.message,
      topicName: 'topic-notification-event',
      status: extractStatus(status)
    }
  }
}
