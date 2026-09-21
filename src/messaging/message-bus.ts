import assert from "node:assert";
import { ApplicationConfig } from "../lib/config";
import { logger } from '../shared/logger';
import { DispatchTransferHandler } from "../handlers/dispatch-transfer-handler";
import { PositionHandlerV2 } from "../handlers/position-v2";
import { TimeoutHandlerV2 } from "../handlers/timeout-v2";
import { CronJob } from "cron";
import { randomUUID } from "node:crypto";
import MessagingHelper from "./helper";

const { Enum, Util } = require('@mojaloop/central-services-shared')
const { StreamingProtocol } = Util
const { Consumer, Producer } = require('@mojaloop/central-services-stream').Util
const SettlementModelCached = require('../models/settlement/settlementModelCached')

/**
 * Handlers emit `Effects`: messages emitted by the messaging layer to continue
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
    timeoutHandler: TimeoutHandlerV2
  },
  helper: MessagingHelper
}

export enum HandlerName {
  prepare = 'prepare',
  position = 'position',
  positionbatch = 'positionbatch',
  get = 'get',
  fulfil = 'fulfil',
  timeout = 'timeout',
  admin = 'admin',
  bulkprepare = 'bulkprepare',
  bulkfulfil = 'bulkfulfil',
  bulkprocessing = 'bulkprocessing',
  bulkget = 'bulkget',
  deferredSettlement = 'deferredSettlement',
  grossSettlement = 'grossSettlement',
  rules = 'rules',
}

/**
 * @class MessageBus
 * @description An abstraction over the messaging layer (currently implemented in Kafka) which lets
 * us remove the direct kafka calls from the handlers (such as `Kafka.proceed()`).
 */
export class MessageBus {
  private config: ApplicationConfig

  constructor(private deps: Dependencies) {
    this.config = deps.config
  }

  /**
   * @description Register the specified handlers.
   * @param handlers?: {Array<HandlerName>} - The list of handlers to register. If not set, defaults
   *   to register all handlers.
   */
  public async init(handlers?: Array<HandlerName>): Promise<void> {
    // Initialize caches that handlers depend on
    await SettlementModelCached.initialize()

    // Older handler imports
    const handlerAdmin = require('../handlers/admin/handler.js')
    const handlerTransfer = require('../handlers/transfers/handler.js')
    const handlerPosition = require('../handlers/positions/handler.js')
    const handlerBulkPrepare = require('../handlers/bulk/prepare/handler.js')
    const handlerBulkFulfil = require('../handlers/bulk/fulfil/handler.js')
    const handlerBulkProcessing = require('../handlers/bulk/processing/handler.js')
    const handlerBulkGet = require('../handlers/bulk/get/handler.js')
    const handlerDeferredSettlement = require('../settlement/handlers/deferredSettlement/handler.js')
    const handlerGrossSettlement = require('../settlement/handlers/grossSettlement/handler.js')
    const handlerRules = require('../settlement/handlers/rules/handler.js')

    if (!handlers) {
      logger.warn(`MessageBus.init() - handlers not defined, defaulting to all handlers.`)
      handlers = [
        HandlerName.prepare,
        HandlerName.position,
        HandlerName.positionbatch,
        HandlerName.get,
        HandlerName.fulfil,
        HandlerName.timeout,
        HandlerName.admin,
        HandlerName.bulkprepare,
        HandlerName.bulkfulfil,
        HandlerName.bulkprocessing,
        HandlerName.bulkget,
        HandlerName.deferredSettlement,
        HandlerName.grossSettlement,
        HandlerName.rules,
      ]
    }

    for (const name of handlers) {
      switch (name) {
        case HandlerName.prepare: {
          await Consumer.createHandler(
            'topic-transfer-prepare', 
            this.config.KAFKA_CONFIG.CONSUMER.TRANSFER.PREPARE.config, 
            this.prepare.bind(this)
          )
          logger.info(`Registered handler: ${name} on topic: topic-transfer-prepare`)
          break
        }
        case HandlerName.position: {
          await Consumer.createHandler(
            'topic-transfer-position', 
            this.config.KAFKA_CONFIG.CONSUMER.TRANSFER.POSITION.config,
            handlerPosition.positions
          )
          logger.info(`Registered handler: ${name} on topic: topic-transfer-position`)
          break
        }
        case HandlerName.positionbatch: {
          await Consumer.createHandler(
            'topic-transfer-position-batch',
            this.config.KAFKA_CONFIG.CONSUMER.TRANSFER.POSITION_BATCH.config,
            this.position.bind(this)
          )
          logger.info(`Registered handler: ${name} on topic: topic-transfer-position-batch`)
          break
        }
        case HandlerName.get: {
          await Consumer.createHandler(
            'topic-transfer-get',
            this.config.KAFKA_CONFIG.CONSUMER.TRANSFER.GET.config,
            handlerTransfer.getTransfer
          )
          logger.info(`Registered handler: ${name} on topic: topic-transfer-get`)
          break
        }
        case HandlerName.fulfil: {
          await Consumer.createHandler(
            'topic-transfer-fulfil',
            this.config.KAFKA_CONFIG.CONSUMER.TRANSFER.FULFIL.config,
            this.fulfil.bind(this)
          )
          logger.info(`Registered handler: ${name} on topic: topic-transfer-fulfil`)
          break
        }
        case HandlerName.timeout: {
          const timeoutJob = CronJob.from({
            cronTime: this.deps.config.HANDLERS_TIMEOUT_TIMEXP,
            onTick: () => this.timeout(new Date()),
            start: false,
            timeZone: this.deps.config.HANDLERS_TIMEOUT_TIMEZONE
          })
          timeoutJob.start()

          logger.info(`Registered timeout handler.`)
          break
        }
        case HandlerName.admin: {
          await Consumer.createHandler(
            'topic-admin-transfer', 
            this.config.KAFKA_CONFIG.CONSUMER.ADMIN.TRANSFER.config,
            handlerAdmin.transfer
          )
          logger.info(`Registered handler: ${name} on topic: topic-admin-transfer`)
          break
        }
        case HandlerName.bulkprepare: {
          await Consumer.createHandler(
            'topic-bulk-prepare', 
            this.config.KAFKA_CONFIG.CONSUMER.BULK.PREPARE.config, 
            handlerBulkPrepare.bulkPrepare
          )
          logger.info(`Registered handler: ${name} on topic: topic-bulk-prepare`)
          break
        }
        case HandlerName.bulkfulfil: {
          await Consumer.createHandler(
            'topic-bulk-fulfil', 
            this.config.KAFKA_CONFIG.CONSUMER.BULK.FULFIL.config,
            handlerBulkFulfil.bulkFulfil
          )
          logger.info(`Registered handler: ${name} on topic: topic-bulk-fulfil`)
          break
        }
        case HandlerName.bulkprocessing: {
          await Consumer.createHandler(
            'topic-bulk-processing', 
            this.config.KAFKA_CONFIG.CONSUMER.BULK.PROCESSING.config, 
            handlerBulkProcessing.bulkProcessing
          )
          logger.info(`Registered handler: ${name} on topic: topic-bulk-processing`)
          break
        }
        case HandlerName.bulkget: {
          await Consumer.createHandler(
            'topic-bulk-get', 
            this.config.KAFKA_CONFIG.CONSUMER.BULK.GET.config, 
            handlerBulkGet.getBulkTransfer
          )
          logger.info(`Registered handler: ${name} on topic: topic-bulk-get`)
          break
        }
        case HandlerName.deferredSettlement: {
          await Consumer.createHandler(
            'topic-deferredsettlement-close',
            this.config.KAFKA_CONFIG.CONSUMER.DEFERREDSETTLEMENT.CLOSE.config,
            handlerDeferredSettlement.closeSettlementWindow
          )
          logger.info(`Registered handler: ${name} on topic: topic-deferredsettlement-close`)
          break
        }
        case HandlerName.grossSettlement: {
          await Consumer.createHandler(
            'topic-notification-event', 
            this.config.KAFKA_CONFIG.CONSUMER.NOTIFICATION.EVENT.config,
            handlerGrossSettlement.processTransferSettlement
          )
          logger.info(`Registered handler: ${name} on topic: topic-notification-event`)
          break
        }
        case HandlerName.rules: {
          await Consumer.createHandler(
            'topic-notification-event',
            this.config.KAFKA_CONFIG.CONSUMER.NOTIFICATION.EVENT.config,
            handlerRules.processRules
          )
          logger.info(`Registered handler: ${name} on topic: topic-notification-event`)
          break
        }
      }
    }
  }

  public async deinit(): Promise<void> {
    // Stop listening to kafka.
    await Consumer.disconnectAll()
    await Producer.disconnect(null)
  }

  public getConsumerTopics(): string[] {
    return Consumer.getListOfTopics()
  }

  public async prepare(error: any, messages: Array<any>): Promise<void> {
    const results = await this.deps.handlers.dispatchTransferHandler.prepare(error, messages)
    await this.emit(this.collectEffects(results))
    await this.commit('topic-transfer-prepare', messages)
  }

  public async fulfil(error: any, messages: Array<any>): Promise<void> {
    const results = await this.deps.handlers.dispatchTransferHandler.fulfil(error, messages)
    await this.emit(this.collectEffects(results))
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

  public async timeout(now: Date): Promise<void> {
    logger.info(`MessageBus.timeout() called for date: ${now.toISOString()}.`)
    const result = await this.deps.handlers.timeoutHandler.run(now)
    const effects = result.results.map(result => result.effect)

    if (this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'UNFUSE') {
      await this.emit(effects)
      return
    }

    assert(this.deps.config.HANDLERS_TRANSFER_POSITION_FUSE === 'FUSE')

    // First emit the notifications.
    const effectsNotification = effects.filter(effect => effect.functionality === 'notification')
    await this.emit(effectsNotification)

    // Directly apply the position resets.
    const effectsPosition = effects.filter(effect => effect.functionality === 'position')
    const kafkaPrepares = effectsPosition.map(this.deps.helper.effectToKafkaMessage)
    const resultsPosition = await this.deps.handlers.positionBatchHandler.handle(null, kafkaPrepares)
    await this.emit(this.collectEffects(resultsPosition))
  
    return
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

  /**
   * Helper function to easily resolve the kafka config based on the topic name. 
   */
  private resolveKafkaConfig(topicName: string) {
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

  private collectEffects<T extends { effects: Array<Effect> }>(results: Array<T>): Array<Effect> {
    return results.reduce((acc: Array<Effect>, curr) => acc.concat(curr.effects), [])
  }

  private async emitOne(effect: Effect): Promise<void> {
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

    await Producer.produceMessage(messageProtocol, topicConf, this.resolveKafkaConfig(topicName))
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
}
