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

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------

 ******/

// Unfortunately each Winston logger created by @mojaloop/central-services-logger registers it's own
// uncaughtException handler. There's no easy way to pass through a common logger around, so we set
// the maxListeners to ~13 to avoid the `MaxListenersExceededWarning`.
process.setMaxListeners(13)

// Disable the Event SDK logs globally.
const EventSdkConfig = require('@mojaloop/event-sdk/dist/lib/config')
EventSdkConfig.default.EVENT_LOGGER_LOG_FILTER = ''
const EventSdk = require('@mojaloop/event-sdk')
const span = EventSdk.Tracer.createSpan('thing')
span.audit('Hopefully we dont see this!')

import assert from "assert"
import { execAsync } from "../exec-async"

import Cache from '../../lib/cache'
import { makeConfig } from "../../lib/config/resolver"
import { assertNestedFields, deepMerge } from "../../lib/config/util"
import Db from '../../lib/db'
import Enums from '../../lib/enumCached'
import { Enum } from '@mojaloop/central-services-shared'

const Metrics = require('@mojaloop/central-services-metrics')

// Note: we _must_ use `require()` here, otherwise the global Producer and Consumers are imported
// as empty objects.
const KafkaProducer = require('@mojaloop/central-services-stream').Util.Producer
const KafkaConsumer = require('@mojaloop/central-services-stream').Util.Consumer
const Utility = require('@mojaloop/central-services-shared').Util.Kafka

import AdminHandler from '../../handlers/admin/handler'
import ParticipantCached from '../../models/participant/participantCached'
import ParticipantCurrencyCached from '../../models/participant/participantCurrencyCached'
import ParticipantLimitCached from '../../models/participant/participantLimitCached'
const BatchPositionModelCached = require('../../models/position/batchCached')
const ExternalParticipantCached = require('../../models/participant/externalParticipantCached')

import Logger from "@mojaloop/central-services-logger"
import knex from 'knex'
import { ApplicationConfig, overrideForTesting, RecursivePartial, resetOverride } from "../../lib/config"
import { envOrDefaultNumber, randomAvailablePort } from "../util"
import { Consumer } from "../kafka"
import { Message } from "node-rdkafka"
import { DispatchTransferHandler } from "../../handlers/dispatch-transfer-handler"
import { HandlerName, MessageBus } from "../../messaging/message-bus"
import { PositionHandlerV2 } from "../../handlers/position-v2"
import Expect from "../expect"
import { TimeoutHandlerV2 } from "../../handlers/timeout-v2"
import { LedgerSql } from "../../domain/ledger/ledger-sql"
import PRNG from "../prng"
import {Clock} from "../mock-clock"
import MockClock from "../mock-clock"
import { Redpanda, RedpandaConnectionOptions } from "./redpanda"
import { Redis } from "./redis"
import { MySql, MySqlConnectionOptions } from "./mysql"
import MessagingHelper from "../../messaging/helper"

const logger = Logger.child({ scope: 'harness' })

let ProxyCache: any
let SettlementModelCached: any

export interface HarnessOptions {
  /**
   * A unique id used in naming and logs to disambiguate between multiple harness runs.
   */
  id: number,
}

/**
 * @class Harness
 * 
 * @description Testing harness used to manage the dependencies for running e2e and integration.
 * ```
 * import Harness from './harness
 * const harness = harness.getInstance()
 * ```
 * 
 * Then, in the before() and after() hooks:
 * ```
 * before(async () => {
 *   await harness.up()
 *   await harness.setupGlobals()
 * })
 * 
 * after(async () => {
 *   await harness.teardownGlobals()
 *   await harness.down()
 * })
 * ```
 *
 * Depends on:
 * 1. Docker host for `mysql`, `kafka`, `redis` containers.
 * 2. Filesystem access for `tigerbeetle` binary.
 * 
 * The goal is that the integration tests are responsible for setting up and tearing down their
 * own environment.
 */
export default class Harness {
  private static instance: Harness | null = null;
  private options: HarnessOptions
  private static _prng: PRNG
  private static _clock: Clock
  private dependencyMySql: MySql
  private dependencyRedis: Redis
  private dependencyRedpanda: Redpanda
  private applicationConfig: ApplicationConfig | null = null;
  private applicationConfigOriginal: ApplicationConfig | null = null;
  private omniConsumer: Consumer | null = null;
  private messageQueue: Array<MojaloopKafkaMessage> = []
  private messageQueuePerId: Record<string, Array<MojaloopKafkaMessage>> = {}
  private _dispatchHandler: DispatchTransferHandler | null = null
  private _messageBus: MessageBus | null = null
  private _expect: Expect | null = null
  private _timeoutHandlerV2: TimeoutHandlerV2 | null = null
  private _ledger: LedgerSql | null = null

  /**
   * 
   * There's 2 types of enums:
   * 1. Statically defined enums in types.
   * 2. Enums we need get from the database and pass around for some reason (I really don't know
   *    _why_).
   * 
   * We keep a reference to #2 here for convenience.
   */
  private _enums: any = null;

  public constructor(options: HarnessOptions) {
    this.options = options

    if (!Harness._prng) {
      logger.info('Harness.constructor() - lazy init prng.')
      Harness._prng = new PRNG(envOrDefaultNumber('SEED', Math.floor(Math.random() * 1e8)))
    }
    if (!Harness._clock) {
      logger.info('Harness.constructor() - lazy init clock.')
      Harness._clock = new Clock()
    }

    this.dependencyRedpanda = new Redpanda({
      harnessId: this.options.id
    })

    this.dependencyMySql = new MySql({
      harnessId: this.options.id,
      clock: this.clock,
      databaseName: 'central_ledger',
      migration: {
        type: 'sql',
        sqlFilePath: './src/testing/harness/harness.snapshot.sql',

        // Uncomment below to update the harness.snapshot.sql file. 
        // You'll want to do this after adding new migrations.
        // type: 'knex',
        // updateSqlFilePath: './src/testing/harness/harness.snapshot.sql'
      }
    })

    this.dependencyRedis = new Redis({
      harnessId: this.options.id
    })

  }

  public static randomRunId(): number {
    return Math.floor(Math.random() * (100000 - 10000) + 10000)
  }

  public static getInstance(): Harness {
    if (!Harness.instance) {
      const run = envOrDefaultNumber('RUN', Harness.randomRunId())
      Harness.instance = new Harness({
        id: run,
      })
    }
    return Harness.instance;
  }

  public async up() {
    const timerStart = performance.now()
    await this.checkEnvironment()

    const results = await Promise.allSettled([
      this.dependencyRedpanda.up(),
      this.dependencyMySql.up(),
      this.dependencyRedis.up(),
    ])

    let failed = false
    let failedCount = 0
    let errorMessage = ''
    results.forEach(result => {
      if (result.status === 'rejected') {
        failed = true
        failedCount += 1
        errorMessage += `${result.reason}\n`
      }
    })

    if (failed) {
      logger.error(`Harness.up() encountered: ${failedCount} failure${failed === 1 ? '' : 's'}`)
      logger.error(`Detailed errors: ${errorMessage}`)
      throw new Error(`Harness.up() encountered: ${failedCount} failures.`)
    }

    const defaultConfig = makeConfig()
    const kafkaBroker = `localhost:${this.dependencyRedpanda.connectionOptions.port}`

    // Shortcut to make below more bearable.
    const innerKafkaConfig = {
      config: {
        rdkafkaConf: {
          "metadata.broker.list": kafkaBroker
        }
      }
    }

    const positionHandlerOverrides: Record<string, string> = {
      PREPARE: 'topic-transfer-position-batch',
      FX_PREPARE: 'topic-transfer-position-batch',
      COMMIT: 'topic-transfer-position-batch',
      RESERVE: 'topic-transfer-position-batch',
      FX_RESERVE: 'topic-transfer-position-batch',
      TIMEOUT_RESERVED: 'topic-transfer-position-batch',
      FX_TIMEOUT_RESERVED: 'topic-transfer-position-batch',
      ABORT: 'topic-transfer-position-batch',
      FX_ABORT: 'topic-transfer-position-batch',
    }

    // Override the config based on the harness variables.
    const override: RecursivePartial<ApplicationConfig> = {
      PROXY_CACHE_CONFIG: {
        enabled: true,
        type: 'redis',
        proxyConfig: {
          host: 'localhost',
          port: this.dependencyRedis.connectionOptions.port,
        }
      },
      DATABASE: {
        connection: {
          user: 'root',
          port: this.dependencyMySql.connectionOptions.port,
          timezone: '+00:00',
        }
      },
      KAFKA_CONFIG: {
        EVENT_TYPE_ACTION_TOPIC_MAP: {
          POSITION: positionHandlerOverrides,
        },
        CONSUMER: {
          ADMIN: {
            TRANSFER: innerKafkaConfig,
          },
          TRANSFER: {
            PREPARE: innerKafkaConfig,
            FULFIL: innerKafkaConfig,
            // TODO: remove this when we finish fusing the handlers.
            POSITION: innerKafkaConfig,
            POSITION_BATCH: innerKafkaConfig,
          },
          NOTIFICATION: {
            EVENT: innerKafkaConfig
          },
          DEFERREDSETTLEMENT: {
            CLOSE: innerKafkaConfig
          }
        },
        PRODUCER: {
          ADMIN: {
            TRANSFER: innerKafkaConfig
          },
          TRANSFER: {
            PREPARE: innerKafkaConfig,
            FULFIL: innerKafkaConfig,
            // TODO: remove this when we finish fusing the handlers.
            POSITION: innerKafkaConfig,
          },
          NOTIFICATION: {
            EVENT: innerKafkaConfig
          }
        }
      }
    }
    this.applicationConfig = deepMerge(defaultConfig, override)

    this.omniConsumer = new Consumer('omniconsumer', kafkaBroker)
    await this.omniConsumer.subscribe([
      'topic-transfer-prepare',
      'topic-transfer-fulfil',
      'topic-transfer-position',
      'topic-transfer-position-batch',
      'topic-notification-event',
      'topic-admin-transfer',
    ], (message) => {
      if (message.topic === '__consumer_offsets') {
        return
      }

      try {
        this.appendMessageQueue(message)
      } catch (err: any) {
        console.error('Failed to append message to queue:\n')
        console.error(err.message)
        console.error(err.stack)
      }
    })

    this._expect = new Expect(this.applicationConfig, this)

    const timerEnd = performance.now()
    logger.warn(`Harness.up() took: ${(timerEnd - timerStart).toFixed(0)} ms.`)
  }

  get mySqlConnectionOptions(): MySqlConnectionOptions {
    return this.dependencyMySql.connectionOptions
  }

  get redpandaConnectionOptions(): RedpandaConnectionOptions {
    return this.dependencyRedpanda.connectionOptions
  }

  get config(): ApplicationConfig {
    assert(this.applicationConfig, 'No this.applicationConfig. Did you forget to call up()?')
    return this.applicationConfig
  }

  get enums(): any {
    assert(this._enums, 'Enums not initalized. Did you forget to call setupGlobals()?')
    return this._enums
  }

  get messageBus(): MessageBus {
    assert(this._messageBus, 'MessageBus not initialized. Did you forget to call setupGlobals()?')
    return this._messageBus
  }

  get timeoutHandler(): TimeoutHandlerV2 {
    assert(this._timeoutHandlerV2, 'TimeoutHandler not initialized. Did you forget to call setupGlobals()?')
    return this._timeoutHandlerV2
  }

  get topicTransferPrepare(): { topicName: string } {
    return Utility.createGeneralTopicConf(
      this.config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
      Enum.Events.Event.Type.TRANSFER,
      Enum.Events.Event.Type.PREPARE
    )
  }

  get topicTransferFulfil(): { topicName: string } {
    return Utility.createGeneralTopicConf(
      this.config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
      Enum.Events.Event.Type.TRANSFER,
      Enum.Events.Event.Type.FULFIL,
    )
  }

  get expect(): Expect {
    assert(this._expect, 'Enums not initalized. Did you forget to call up()?')
    return this._expect
  }

  get ledger(): LedgerSql {
    assert(this._ledger, 'Ledger not initialized. Did you forget to call setupGlobals()?')
    return this._ledger
  }

  get prng() {
    return Harness._prng
  }

  get clock() {
    assert(Harness._clock, 'no Harness._clock, did you call `Harness.injectPrngAndPatchDateGlobal`?')
    return Harness._clock
  }

  get seed(): number {
    assert(Harness._prng, 'no Harness._prng, did you call `Harness.injectPrngAndPatchDateGlobal`?')
    return Harness._prng.seed
  }

  /**
   * Override the Application Config.
   */
  public configOverride(override: Partial<ApplicationConfig>): void {
    // Override this instance.
    this.applicationConfigOriginal = this.applicationConfig
    this.applicationConfig = deepMerge(this.config, override)

    // Override for global imports.
    overrideForTesting(override)
  }

  /**
   * Reset the override
   */
  public configResetOverride(): void {
    this.applicationConfigOriginal = null
    this.applicationConfig = this.applicationConfigOriginal
  }

  private appendMessageQueue(message: Message): void {
    assert(message)
    assert(message.value)
    const messageValueStr = message.value.toString()
    const parsed = JSON.parse(messageValueStr)
    assert(parsed)

    const mojaloopKafkaMessage = {
      ...message,
      valueStr: messageValueStr,
      valueParsed: parsed
    } as MojaloopKafkaMessage

    // Still push to the general queue. Unfortunately for some commands, they don't have 
    // correlationIds we can pipe through, so we need to rely on the total messages.
    this.messageQueue.push(mojaloopKafkaMessage)

    // Pull out a correlation id from the message, based on the topic.
    // Could be a transferId (in multiple places, or some other id)
    let correlationId
    switch (mojaloopKafkaMessage.topic) {
      case 'topic-notification-event': {
        assertNestedFields(parsed, 'metadata.event.action')
        switch (parsed.metadata.event.action) {
          case 'limit-adjustment': {
            assert(parsed.from)
            correlationId = parsed.from
            break;
          }
          case 'fx-prepare-duplicate':
          case 'forwarded':
          case 'fx-forwarded':
          case 'fx-fulfil':
            {
              assertNestedFields(parsed, 'content.uriParams.id')
              correlationId = parsed.content.uriParams.id
              break;
            }
          case 'fx-prepare': {
            if (parsed.id) {
              correlationId = parsed.id
            } else {
              assertNestedFields(parsed, 'content.uriParams.id')
              correlationId = parsed.content.uriParams.id
            }
            break;
          }
          case 'prepare-duplicate':
          case 'fulfil-duplicate':
          case 'prepare': {
            // It can either be at parsed.id, or at parsed.content.uriParams.id.
            if (parsed.id) {
              correlationId = parsed.id
            } else {
              assertNestedFields(parsed, 'content.uriParams.id')
              correlationId = parsed.content.uriParams.id
            }
            break;
          }
          default: {
            if (parsed.id) {
              correlationId = parsed.id
            }
          }
        }
        break
      }
      case 'topic-admin-transfer': {
        if (parsed.id) {
          correlationId = parsed.id
        }
        break;
      }
      case 'topic-transfer-position':
      case 'topic-transfer-position-batch': {
        assertNestedFields(parsed, 'metadata.event.action')
        switch (parsed.metadata.event.action) {
          case 'commit':
          case 'fx-reserve':
          case 'fx-abort':
          case 'abort':
          case 'timeout-reserved':
          case 'fx-abort-validation':
          case 'fx-timeout-reserved':
            {
              assertNestedFields(parsed, 'content.uriParams.id')
              correlationId = parsed.content.uriParams.id
              break;
            }
          case 'fx-prepare': {
            assertNestedFields(parsed, 'content.payload.commitRequestId')
            correlationId = parsed.content.payload.commitRequestId
            break;
          }
          default: {
            assertNestedFields(parsed, 'content.payload.transferId', `for action: ${parsed.metadata.event.action}`)
            correlationId = parsed.content.payload.transferId
          }
        }
        break;
      }
      default: {
        throw new Error(`Unhandled topic: ${mojaloopKafkaMessage.topic}.`)
      }
    }

    if (correlationId) {
      let messages = this.messageQueuePerId[correlationId]
      if (!messages) {
        messages = []
      }
      messages.push(mojaloopKafkaMessage)
      this.messageQueuePerId[correlationId] = messages
    } else {
      logger.warn(`No correlationId for topic: ${mojaloopKafkaMessage.topic} action: ${parsed.metadata.event.action}. `)
    }
  }

  /**
   * Legacy central-ledger code uses a lot of globals everywhere. This is a convenience function
   * so we don't have to call this at the start of each test.
   */
  public async setupGlobals(options?: {
    skipMessageBus?: boolean
  }): Promise<void> {
    logger.info('setupGlobals()')
    // Override the global config with our testing config.
    overrideForTesting(this.config)

    ProxyCache = require('../../lib/proxyCache')
    await ProxyCache.connect()

    SettlementModelCached = require('../../models/settlement/settlementModelCached')
    await SettlementModelCached.initialize()

    await Db.connect(this.config.DATABASE)
    await ParticipantCached.initialize()
    await ParticipantCurrencyCached.initialize()
    await BatchPositionModelCached.initialize()
    ExternalParticipantCached.initialize()

    await ParticipantLimitCached.initialize()
    await Cache.initCache()
    Metrics.setup(this.config.INSTRUMENTATION_METRICS_CONFIG)

    Enums.initialize()
    this._enums = await Enums.getEnums('all')

    // Set up the MessageBus.
    const {
      createRemittanceEntityPayment,
      createRemittanceEntityForex,
    } = require('../../handlers/transfers/createRemittanceEntity')
    const { definePositionParticipant } = require('../../handlers/transfers/prepare')

    const helper = new MessagingHelper({
      config: this.config,
      randomUUID: () => this.prng.uuidv4()
    })
    const positionHandlerV2 = new PositionHandlerV2(this.config)
    this._ledger = new LedgerSql({
      config: this.config,
      enums: this._enums,
      proxyCache: ProxyCache,
      positionHandler: positionHandlerV2,
      createRemittanceEntity: createRemittanceEntityPayment,
      definePositionParticipant,
      effectToKafkaMessage: helper.effectToKafkaMessage.bind(helper)
    })
    this._dispatchHandler = new DispatchTransferHandler(this.config, this._ledger)
    this._timeoutHandlerV2 = new TimeoutHandlerV2(this.config, this._ledger)
    this._messageBus = new MessageBus({
      config: this.config,
      handlers: {
        dispatchTransferHandler: this._dispatchHandler,
        positionBatchHandler: positionHandlerV2,
        timeoutHandler: this._timeoutHandlerV2,
      },
      helper
    })

    if (options?.skipMessageBus) {
      logger.info(`teardownGlobals() - skipping messageBus.init().`)
    } else {
      await this.messageBus.init([
        HandlerName.prepare,
        HandlerName.fulfil,
        HandlerName.position,
        HandlerName.positionbatch,
      ])
    }
  }

  public async teardownGlobals(options?: {
    skipMessageBus?: boolean
  }): Promise<void> {
    try {
      logger.info('teardownGlobals()')
    
      // MessageBus always created, just not always inited.
      assert(this.messageBus)
      if (options?.skipMessageBus) {
        logger.info(`teardownGlobals() - skipping messageBus.deinit().`)
      } else {
        await this.messageBus?.deinit()
      }
      
      // Reset the caches.
      await ParticipantCached.invalidateParticipantsCache()
      await ParticipantCurrencyCached.invalidateParticipantCurrencyCache()
      await ParticipantLimitCached.invalidateParticipantLimitCache()
      await ExternalParticipantCached.invalidateCache()
      await SettlementModelCached.invalidateSettlementModelsCache()
      await Enums.invalidateEnumCache()
  
      // Disconnect the caches.
      await ProxyCache.disconnect()
      await Cache.destroyCache()
      await Db.disconnect()
      await KafkaProducer.disconnect()
      await KafkaConsumer.disconnectAll()
    } catch (err: any) {
      logger.error(`teardownGlobals() failed with error: ${err.message}`)
      throw err
    }
  }

  private async checkEnvironment() {
    try {
      // Check that docker is installed.
      await execAsync(`docker --version`)
    } catch (err: any) {
      logger.error(`command: 'docker --version' failed. Ensure docker is installed in this 
environment!\n ${err.message}`)
      throw new Error('checkEnvironment() failed.')
    }

    try {
      // Check that we have a docker daemon running.
      await execAsync(`docker ps`)
    } catch (err: any) {
      logger.error(`command: 'docker ps' failed. Is the docker daemon running?\n ${err.message}`)
      throw new Error('checkEnvironment() failed.')
    }
  }

  public async down() {
    let forceExit = false
    const start = performance.now()
    logger.warn(`harness.down()`)

    if (this.omniConsumer) {
      try {
        await this.omniConsumer.disconnect()
      } catch (err: any) {
        forceExit = true
      }
    }

    const results = await Promise.allSettled([
      this.dependencyRedpanda.down(),
      this.dependencyMySql.down(),
      this.dependencyRedis.down(),
    ])

    let failed = false
    let failedCount = 0
    let errorMessage = ''
    results.forEach(result => {
      if (result.status === 'rejected') {
        failed = true
        failedCount += 1
        errorMessage += `${result.reason}\n`
      }
    })

    if (failed) {
      logger.error(`Harness.down() encountered: ${failedCount} failure${failed === 1 ? '' : 's'}`)
      logger.error(`Detailed errors: ${errorMessage}`)
      throw new Error(`Harness.down() encountered: ${failedCount} failures.`)
    }

    const end = performance.now()
    logger.warn(`Harness.down() took: ${(end - start).toFixed(0)} ms.`)

    if (forceExit) {
      logger.warn('force exiting')
      setTimeout(() => process.kill(process.pid, 'SIGKILL'), 4000);
    }
  }

  /**
   * @description Look for messages related to a correlation id.
   */
  public async redpandaDrainSmart(numMessages: number, id: string, attempts: number = 25):
    Promise<Array<MojaloopKafkaMessage>> {
    const start = performance.now()
    let delayMs = 10

    // Init.
    if (!this.messageQueuePerId[id]) {
      this.messageQueuePerId[id] = []
    }

    let markNew
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        markNew = this.messageQueuePerId[id].length
        if (markNew > numMessages) {
          const errorMessage = `Redpanda expected to consume: ${numMessages} for id: ${id}, but consumed: ${markNew}.`
          logger.error(errorMessage)
          this.print(this.messageQueuePerId[id])
          throw new Error(errorMessage)
        }

        if (markNew === numMessages) {
          const end = performance.now()

          // Cool down for 20ms, check that there are no late messages.
          await new Promise(resolve => setTimeout(resolve, 20))
          const checkAgain = this.messageQueuePerId[id].length
          const extraMessages = checkAgain - markNew
          assert(extraMessages >= 0)
          if (extraMessages > 0) {
            const errorMessage = `After cooldown, Redpanda consumed ${extraMessages} extra message${extraMessages === 1 ? ' ' : 's'}.`
            logger.error(errorMessage)

            this.printLast(numMessages + extraMessages)
            throw new Error(errorMessage)
          }

          const messages = structuredClone(this.messageQueuePerId[id])
          // Clear the queue.
          this.messageQueuePerId[id] = []
          return messages
        }

        throw new Error('Not ready')
      } catch (err: any) {
        if (attempt === attempts) {
          const error = new Error(`redpandaDrainSmart() failed to consume ${numMessages} for id: ${id} after ${attempts} attempts.\
Found only ${markNew} new messages.`)
          logger.error(error.message)
          logger.error(error.stack)
          this.print(this.messageQueuePerId[id])
          throw error
        }

        if (err.message !== 'Not ready') {
          logger.error(err.message)
          throw err
        }

        // Slowly back off.
        delayMs = Math.floor((delayMs * 1.1) + 10)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }

    return []
  }

  /**
   * Get the complete message of the last _n_ messages produced across all topics.
   */
  public spoolLast(numMessages: number): Array<MojaloopKafkaMessage> {
    assert(numMessages > 0)

    if (numMessages > this.messageQueue.length) {
      throw new Error(`spoolLast() requested: ${numMessages}, but messageQueue only has: ${this.messageQueue.length} messages.`)
    }

    const last = this.messageQueue.slice(numMessages * -1)
    assert(last.length === numMessages)
    return last
  }

  /**
   * @description Print the last messages in the messageQueue. If `numMessages` is undefined, prints
   * all messages.
   */
  public printLast(numMessages: number): void {
    let messages = this.spoolLast(this.messageQueue.length)

    if (numMessages === 0) {
      numMessages = 5
    }
    assert(numMessages > 0)
    assert(numMessages <= messages.length)
    messages = messages.slice(numMessages * -1)

    logger.warn(`printLast() ${numMessages} messages:`)
    messages.forEach(msg => {
      logger.warn(`\n
      ts:   ${msg.timestamp}
      topic: ${msg.topic}
      uriParams: ${msg.valueParsed.content.uriParams ?
          JSON.stringify(msg.valueParsed.content.uriParams) : ''
        }
      valueParsed:
      ${JSON.stringify(msg.valueParsed.content.payload, null, 2)}
      `.replaceAll(/^\s{6}/gm, ''))
    })
  }

  public print(messages: Array<MojaloopKafkaMessage>): void {
    messages.forEach(msg => {
      logger.warn(`\n
      ts:   ${msg.timestamp}
      topic: ${msg.topic}
      uriParams: ${msg.valueParsed.content.uriParams ?
          JSON.stringify(msg.valueParsed.content.uriParams) : ''
        }
      fspiop-source:      ${msg.valueParsed.content.headers['fspiop-source']}
      fspiop-destination: ${msg.valueParsed.content.headers['fspiop-destination']}
      valueParsed:
      ${JSON.stringify(msg.valueParsed.content.payload, null, 2)}
      `.replaceAll(/^\s{6}/gm, ''))
    })
  }

  /**
   * Sometimes we just want to check the last topics that were published to.
   */
  public spoolLastTopic(numMessages: number): Array<string> {
    return Harness.topicsOf(this.spoolLast(numMessages))
  }

  /**
   * Get the payload of the last _n_ messages produced across all topics.
   */
  public spoolLastPayload(numMessages: number): Array<any> {
    return Harness.payloadsOf(this.spoolLast(numMessages))
  }

  public static topicsOf(messages: Array<MojaloopKafkaMessage>): Array<any> {
    return messages.map(message => message.topic)
  }

  public static payloadsOf(messages: Array<MojaloopKafkaMessage>): Array<any> {
    return messages.map(message => message.valueParsed.content.payload)
  }

  public static injectPrngAndPatchDateGlobal(prng: PRNG, now?: Date): MockClock {
    Harness._prng = prng
    if (!now) {
      now = new Date('2026-02-01T00:00:00.000Z')
    }
    const clock = new MockClock(prng, now)

    // Harness._originalDate = global.Date
    const OriginalDate = global.Date

    global.Date = class extends OriginalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(clock.now.getTime())
        } else {
          // @ts-ignore
          super(...args)
        }
      }

      static now() {
        return clock.now.getTime()
      }

      static parse(str: string) {
        return OriginalDate.parse(str)
      }

      static UTC(...args: any[]) {
        return (OriginalDate.UTC as any)(...args)
      }
    } as any

    Harness._clock = clock
    return clock
  }
}

export interface DependencyOptions {
  harnessId: number,
}


export type MojaloopKafkaMessage = {
  topic: string,
  key: string | Buffer;
  valueStr: string,
  timestamp: number,
  partition: number,
  offset: number,
  valueParsed: {
    content: {
      uriParams: any
      context: any,
      headers: any,
      payload: any,
    },
    metadata: {
      event: any,
      'protocol.createdAt': number,
      trace: any
    }
  }
}

