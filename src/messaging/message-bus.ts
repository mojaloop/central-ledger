/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the 'License') and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

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

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------

 ******/

import assert from 'node:assert';
import { ApplicationConfig } from '../lib/config';
import { logger } from '../shared/logger';
import { DispatchTransferHandler } from '../handlers/dispatch-transfer-handler';
import { CronJob } from 'cron';
import MessagingHelper from './helper';
import { PaymentPrepareResult } from '../handlers/payment-prepare';
import { PaymentFulfilResult } from '../handlers/payment-fulfil';
import { TimeoutHandlerV2 } from '../handlers/timeout-v2';

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
    timeoutHandler: TimeoutHandlerV2
  },
  helper: MessagingHelper
}

/**
 * All of the handlers to be registered. For the current TigerBeetle implementation, we just
 * register prepare, fulfil and timeout.
 */
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
  private helper: MessagingHelper
  private timeoutJob: CronJob

  constructor(private deps: Dependencies) {
    assert(deps.config)
    assert(deps.handlers)
    assert(deps.handlers.dispatchTransferHandler)
    assert(deps.handlers.timeoutHandler)
    assert(deps.helper)

    this.config = deps.config
    this.helper = deps.helper

    this.timeoutJob = CronJob.from({
      cronTime: this.deps.config.HANDLERS_TIMEOUT_TIMEXP,
      onTick: () => this.timeout(new Date()),
      start: false,
      timeZone: this.deps.config.HANDLERS_TIMEOUT_TIMEZONE
    })
  }

  /**
   * @description Register the specified handlers.
   * @param handlers?: {Array<HandlerName>} - The list of handlers to register. If not set, defaults
   *   to prepare, fulfil, timeout handlers.
   */
  public async init(handlers?: Array<HandlerName>): Promise<void> {
    // Initialize caches that handlers depend on
    await SettlementModelCached.initialize()

    if (!handlers) {
      logger.warn(`MessageBus.init() - handlers not defined, defaulting to prepare, fulfil, timeout.`)
      handlers = [
        HandlerName.prepare,
        HandlerName.fulfil,
        HandlerName.timeout,
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
          this.timeoutJob.start()
          logger.info(`Registered timeout handler.`)
          break
        }
      }
    }
  }

  public async deinit(): Promise<void> {
    // Stop the timeout job.
    this.timeoutJob.stop()

    // Stop listening to kafka.
    await Consumer.disconnectAll()
    await Producer.disconnect(null)
  }

  public getConsumerTopics(): string[] {
    return Consumer.getListOfTopics()
  }

  public async prepare(error: any, messages: Array<any>): Promise<void> {
    const results = await this.deps.handlers.dispatchTransferHandler.prepare(error, messages)
    // Separate out the PaymentPrepareResult from the others.
    const effects: Array<Effect> = []
    for (const result of results) {
      if ('input' in result && 'tag' in result) {
        effects.push(...this.deps.helper.buildEffectsPrepare(result as PaymentPrepareResult))
      } else {
        effects.push(...(result as { effects: Array<Effect> }).effects)
      }
    }
    await this.emit(effects)
    await this.commit('topic-transfer-prepare', messages)
  }

  public async fulfil(error: any, messages: Array<any>): Promise<void> {
    const results = await this.deps.handlers.dispatchTransferHandler.fulfil(error, messages)
    // Separate out the PaymentFulfilResult from the others.
    const effects: Array<Effect> = []
    for (const result of results) {
      if ('input' in result && 'tag' in result) {
        effects.push(...this.deps.helper.buildEffectsFulfil(result as PaymentFulfilResult))
      } else {
        effects.push(...(result as { effects: Array<Effect> }).effects)
      }
    }

    await this.emit(effects)
    await this.commit('topic-transfer-fulfil', messages)
  }


  public async timeout(now: Date): Promise<void> {
    try {
      logger.info(`MessageBus.timeout() called for date: ${now.toISOString()}.`)
      const result = await this.deps.handlers.timeoutHandler.run(now)
      const effects = this.helper.buildEffectsTimedOutPayments(result.payments)
      .map(result => result.effect)
      
      // Emit the notifications.
      const effectsNotification = effects.filter(effect => effect.functionality === 'notification')
      await this.emit(effectsNotification)
    } catch (err: any) {
      logger.error(`timeout failed with error: ${err.message}`)
    }
  }

  /**
   * Produce messages to be consumed downstream.
   */
  private async emit(effects: Array<Effect>): Promise<void> {
    const emitResults = await Promise.allSettled(effects.map(effect => this.emitOne(effect)))
    const failures: Array<PromiseRejectedResult> = []
    emitResults.forEach(result => {
      if (result.status === 'rejected') {
        failures.push(result)
        logger.error(`emitOne() failed to emit effect with error: ${result.reason}`)
        if (result.reason.stack) logger.error(`stack\n\t${result.reason.stack}`)
      }
    })

    if (failures.length > 0) {
      throw new AggregateError(
        failures.map(failure => failure.reason),
        `emit() failed for ${failures.length} of ${effects.length} effects.`
      )
    }
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
