import assert from "node:assert";
import { ApplicationConfig } from "../lib/config";
import { logger } from '../shared/logger';
import { DispatchTransferHandler } from "../handlers/dispatch-transfer-handler";
import { PositionHandlerV2 } from "../handlers/position-v2";

const { Enum, Util } = require('@mojaloop/central-services-shared')
const { Kafka, StreamingProtocol } = Util
const { Consumer, Producer } = require('@mojaloop/central-services-stream').Util

/**
 * Handlers emit `Effects`: messages that should be emitted by the messaging layer to continue
 * processing.
 */
export type Effect = {
  functionality: string,
  action: string,
  message: any,
  status: 'SUCCESS' | 'FAILURE'
  topicName: string,

  messageKey?: string,
  topicNameOverride?: string,
  fspiopError?: {
    errorInformation: {
      errorCode: string
      errorDescription: string
    }
  }
}

interface Dependencies {
  config: ApplicationConfig,
  handlers: {
    dispatchTransferHandler: DispatchTransferHandler
    positionBatchHandler: PositionHandlerV2
  }
}

/**
 * @class MessageBus
 * @description An abstraction over the messaging layer (currently implemented in Kafka) which lets
 * us remove the direct kafka calls from the handlers (such as `Kafka.proceed()`).
 */
export class MessageBus {
  private config: ApplicationConfig
  private positionMutex: Mutex

  constructor(private deps: Dependencies) {
    this.config = deps.config
    this.positionMutex = new Mutex()
  }

  /**
   * Register the required handlers etc.
   */
  public async init(): Promise<void> {
    const topicConsumePrepare = 'topic-transfer-prepare'
    const topicConsumeFulfil = 'topic-transfer-fulfil'
    const topicConsumePosition = 'topic-transfer-position'
    const topicConsumePositionBatch = 'topic-transfer-position-batch'

    const configConsumePrepare = this.config.KAFKA_CONFIG.CONSUMER.TRANSFER.PREPARE.config
    const configConsumeFulfil = this.config.KAFKA_CONFIG.CONSUMER.TRANSFER.FULFIL.config
    const configConsumePositon = this.config.KAFKA_CONFIG.CONSUMER.TRANSFER.POSITION.config
    const configConsumePositonBatch = this.config.KAFKA_CONFIG.CONSUMER.TRANSFER.POSITION_BATCH.config

    configConsumePrepare.rdkafkaConf['client.id'] = topicConsumePrepare
    configConsumeFulfil.rdkafkaConf['client.id'] = topicConsumeFulfil
    configConsumePositon.rdkafkaConf['client.id'] = topicConsumePosition
    configConsumePositonBatch.rdkafkaConf['client.id'] = topicConsumePositionBatch

    await Consumer.createHandler(topicConsumePrepare, configConsumePrepare, this.prepare.bind(this))
    await Consumer.createHandler(topicConsumeFulfil, configConsumeFulfil, this.fulfil.bind(this))
    // await Consumer.createHandler(topicConsumePosition, configConsumePositon, this.position.bind(this))
    await Consumer.createHandler(topicConsumePositionBatch, configConsumePositonBatch, this.position.bind(this))
  }

  public async deinit(): Promise<void> {
    // Stop listening to kafka.
    await Consumer.disconnectAll()
    await Producer.disconnect(null)
  }

  public getConsumerTopics(): string[] {
    return Consumer.getListOfTopics()
  }

  private collectEffects<T extends { effects: Array<Effect> }>(results: Array<T>): Array<Effect> {
    return results.reduce((acc: Array<Effect>, curr) => acc.concat(curr.effects), [])
  }

  public async prepare(error: any, messages: Array<any>): Promise<void> {
    // TODO: add output messages, offset and result.
    const results = await this.deps.handlers.dispatchTransferHandler.prepare(error, messages)
    const effectsPrepare = this.collectEffects(results)

    if (this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'UNFUSE') {
      // Collect all messages to be emitted.
      await this.emit(effectsPrepare)
      await this.commit('topic-transfer-prepare', messages)

      return
    }

    assert(this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'FUSE')
    // Transform effectsPrepare to something that positionBatchHandler can tolerate.
    const kafkaPrepares = effectsPrepare.map(this.effectToKafkaMessage)
    const resultsPosition = await this.positionMutex.runExclusive(async () => {
      return await this.deps.handlers.positionBatchHandler.handle(error, kafkaPrepares)
    })

    await this.emit(this.collectEffects(resultsPosition))
    await this.commit('topic-transfer-prepare', messages)
  }

  public async fulfil(error: any, messages: Array<any>): Promise<void> {
    const results = await this.deps.handlers.dispatchTransferHandler.fulfil(error, messages)
    const effectsFulfil = this.collectEffects(results)
    if (this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'UNFUSE') {
      // Collect all messages to be emitted.
      await this.emit(effectsFulfil)
      await this.commit('topic-transfer-fulfil', messages)

      return
    }

    // Skip going back around, go directly to paymentPosition.
    assert(this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'FUSE')
    // Transform effectsPrepare to something that positionBatchHandler can tolerate.
    const kafkaPrepares = effectsFulfil.map(this.effectToKafkaMessage)
    const resultsPosition = await this.deps.handlers.positionBatchHandler.handle(error, kafkaPrepares)
    await this.emit(this.collectEffects(resultsPosition))
    await this.commit('topic-transfer-fulfil', messages)
  }

  public async position(error: any, messages: Array<any>): Promise<void> {
    // This code path should only be called from an external handler, therefore it must be UNFUSE.
    assert(this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'UNFUSE')

    const results = await this.deps.handlers.positionBatchHandler.handle(error, messages)
    const effects = results.reduce((acc: Array<Effect>, curr) => acc.concat(curr.effects), [])
    await this.emit(effects)
    await this.commit('topic-transfer-position-batch', messages)
  }

  /**
   * Produce messages to be consumed downstream.
   */
  private async emit(effects: Array<Effect>): Promise<void> {
    const emitResults = await Promise.allSettled(effects.map(effect => this.emitOne(effect)))
    emitResults.forEach(result => {
      if (result.status === 'rejected') {
        logger.error(`emitOne() failed to emit effect with error: ${result.reason}`)
        if (result.reason.stack) logger.error(`stack\n\t${result.reason.stack}`)
      }
    })
  }

  private async emitOne(effect: Effect): Promise<void> {
    const resolveKafkaConfig = (topicName: string) => {
      switch (topicName) {
        case 'topic-transfer-position':
        case 'topic-transfer-position-batch':
          return this.deps.config.KAFKA_CONFIG.PRODUCER.TRANSFER.POSITION.config
        case 'topic-notification-event':
          return this.deps.config.KAFKA_CONFIG.PRODUCER.NOTIFICATION.EVENT.config
        default:
          throw new Error(`resolveKafkaConfig: unhandled topicName: ${topicName}.`)
      }
    }

    const { functionality, action, message, messageKey, topicName, status } = effect
    const eventStatus = Enum.Events.EventStatus[status]
    assert(eventStatus)
    const messageProtocol = StreamingProtocol.updateMessageProtocolMetadata(
      message, functionality, action, eventStatus
    )

    const topicConf = {
      topicName,
      key: messageKey ?? null,
      partition: null,
      opaqueKey: null
    }

    await Producer.produceMessage(messageProtocol, topicConf, resolveKafkaConfig(topicName))
  }

  /**
   * Commit the kafka offsets for a topic.
   */
  private async commit(topic: string, messages: Array<any>): Promise<void> {
    assert(messages.length > 0, 'commit() expected at least 1 message.')
    const lastMessage = messages[messages.length - 1]
    if (Consumer.isConsumerAutoCommitEnabled(topic)) {
      throw new Error(`Config error - isConsumerAutoCommitEnabled for ${topic}.\
Disable it to use the new message bus.`)
    }

    if (lastMessage.partition === undefined || lastMessage.offset === undefined) {
      // Test message, no valid offset to commit.
      return
    }

    const consumer = Consumer.getConsumer(topic)
    assert(consumer)
    await consumer.commitMessageSync(lastMessage)
  }

  private effectToKafkaMessage(effect: Effect) {
    return {
      key: effect.messageKey,
      value: effect.message
    }
  }
}


class Mutex {
  private queue: Promise<void> = Promise.resolve()

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void
    const waitForPrevious = this.queue
    this.queue = new Promise(resolve => {release = resolve})

    await waitForPrevious
    try {
      return await fn()
    } finally {
      release!()
    }
  }

}