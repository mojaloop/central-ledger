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
import { execAsync } from "./exec-async"

import Cache from '../lib/cache'
import { makeConfig } from "../lib/config/resolver"
import { deepMerge } from "../lib/config/util"
import Db from '../lib/db'
import Enums from '../lib/enumCached'
import { Enum } from '@mojaloop/central-services-shared'

const Metrics = require('@mojaloop/central-services-metrics')

// Note: we _must_ use `require()` here, otherwise the global Producer and Consumers are imported
// as empty objects.
const KafkaProducer = require('@mojaloop/central-services-stream').Util.Producer
const KafkaConsumer = require('@mojaloop/central-services-stream').Util.Consumer
const Utility = require('@mojaloop/central-services-shared').Util.Kafka

import AdminHandler from '../handlers/admin/handler'
import PositionHandler from '../handlers/positions/handler'
import PositionBatchHandler from '../handlers/positions/handlerBatch'

import ParticipantCached from '../models/participant/participantCached'
import ParticipantCurrencyCached from '../models/participant/participantCurrencyCached'
import ParticipantLimitCached from '../models/participant/participantLimitCached'
import ProxyCache from '../lib/proxyCache'
const BatchPositionModelCached = require('../models/position/batchCached')
const ExternalParticipantCached = require('../models/participant/externalParticipantCached')

import Logger from "@mojaloop/central-services-logger"
import knex from 'knex'
import { ApplicationConfig, overrideForTesting, RecursivePartial, resetOverride } from "../lib/config"
import { randomAvailablePort } from "./util"
import { Consumer } from "./kafka"
import { Message } from "node-rdkafka"

const logger = Logger.child({ scope: 'harness' })

export interface HarnessOptions {
  /**
   * A unique id used in naming and logs to disambiguate between multiple harness runs.
   */
  id: number
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
  private dependencyRedpanda: Redpanda
  private dependencyMySql: MySql
  private dependencyRedis: Redis
  private applicationConfig: ApplicationConfig | null = null;
  private omniConsumer: Consumer | null = null;
  private messageQueue: Array<MojaloopKafkaMessage> = []
  private positionHandlerType: 'NON_BATCH' | 'BATCH' = 'NON_BATCH'

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

  private constructor(options: HarnessOptions) {
    this.options = options

    this.dependencyRedpanda = new Redpanda({
      harnessId: this.options.id
    })

    this.dependencyMySql = new MySql({
      harnessId: this.options.id,
      databaseName: 'central_ledger',
      migration: {
        type: 'sql',
        sqlFilePath: './src/testing/harness.snapshot.sql',

        // Uncomment below to update the harness.snapshot.sql file. 
        // You'll want to do this after adding new migrations.
        // type: 'knex',
        // updateSqlFilePath: './src/testing/harness.snapshot.sql'
      }
    })

    this.dependencyRedis = new Redis({
      harnessId: this.options.id
    })
  }

  public static getInstance(): Harness {
    if (!Harness.instance) {
      let run = Math.floor(Math.random() * (100000 - 10000) + 10000)
      if (process.env.RUN) {
        try {
          run = Number.parseInt(process.env.RUN)
        } catch (err: any) {
          throw new Error(`Invalid test run id. process.env.RUN should be an integer.`)
        }
      }

      Harness.instance = new Harness({
        id: run,
      })
    }
    return Harness.instance;
  }

  /**
   * The BATCH position handler contains a bug which makes it unable to properly process 
   * aborted transfers. Since we will be soon removing the position handlers, we work around
   * this bug by allowing the harness to specify whether or not to use the NON_BATCH or BATCH
   * position handler for a specific test.
   * 
   * The bug is related to cyrilResult not being set for a non-fx transfer, which causes the 
   * position rest message to not be fired.
   */
  public async up(positionHandlerType: 'NON_BATCH' | 'BATCH' = 'NON_BATCH') {
    const start = performance.now()
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

    this.positionHandlerType = positionHandlerType
    let positionHandlerOverrides: Record<string, string> = {
      PREPARE: 'topic-transfer-position',
      COMMIT: 'topic-transfer-position',
      RESERVE: 'topic-transfer-position',
      TIMEOUT_RESERVED: 'topic-transfer-position',
      ABORT: 'topic-transfer-position'
    }

    if (positionHandlerType === 'BATCH') {
      positionHandlerOverrides = {
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
    await this.omniConsumer?.subscribe([
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
      }
    })

    const end = performance.now()
    logger.warn(`Harness.up() took: ${(end - start).toFixed(0)} ms.`)
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

  private appendMessageQueue(message: Message): void {
    assert(message)
    assert(message.value)
    const messageValueStr = message.value.toString()
    const parsed = JSON.parse(messageValueStr)
    assert(parsed)

    assert(message.timestamp, 'message.timestamp is not defined.')

    const mojaloopKafkaMessage = {
      ...message,
      valueStr: messageValueStr,
      valueParsed: parsed
    } as MojaloopKafkaMessage
    const lastMessage = this.peekMessageQueue()
    const lastTimestamp = lastMessage ? lastMessage.timestamp : 0
    // Even if the message is outdated, still append to the message queue instead of dropping it.
    // This warning will help us catch tests that have overlapping messages.
    if (mojaloopKafkaMessage.timestamp < lastTimestamp) {
      const message = `appendMessageQueue() inserted a stale message with timestamp:\
        ${mojaloopKafkaMessage.timestamp} after message with timestamp: ${lastTimestamp}.`
      logger.warn(message)
    }
    this.messageQueue.push(mojaloopKafkaMessage)
  }

  /**
   * Get the last message from the queue.
   */
  private peekMessageQueue(): MojaloopKafkaMessage | undefined {
    if (this.messageQueue.length === 0) {
      return
    }
    return this.messageQueue.at(-1)
  }

  /**
   * Legacy central-ledger code uses a lot of globals everywhere. This is a convenience function
   * so we don't have to call this at the start of each test.
   */
  public async setupGlobals(): Promise<void> {
    logger.info('setupGlobals()')
    // Override the global config with our testing config.
    overrideForTesting(this.config)

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

    // Register the `topic-transfer-position` consumer
    // Because the kafka registration uses global scope, we cannot register both the non batch
    // and batch position handlers, in spite of the fact that they have different topics.
    switch (this.positionHandlerType) {
      case 'NON_BATCH':
        await PositionHandler.registerPositionHandler()
        break;
      case 'BATCH':
        await PositionBatchHandler.registerPositionHandler()
        break;
    }

    await AdminHandler.registerAllHandlers()
  }

  public async teardownGlobals(): Promise<void> {
    try {
      logger.info('teardownGlobals()')
      await ProxyCache.disconnect()
      await Cache.destroyCache()
      await Db.disconnect()
      await KafkaProducer.disconnect()
      await KafkaConsumer.disconnectAll()
      resetOverride()
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

  public redpandaMark(): number {
    return this.messageQueue.length
  }

  /**
   * @description Wait for redpanda to produce and consume _n_ messages.
   */
  public async redpandaDrain(markLast: number, numMessages: number, attempts: number = 25): Promise<void> {
    const start = performance.now()
    assert(markLast >= 0)
    assert(numMessages >= 0)

    let delayMs = 10
    let markNew = this.messageQueue.length
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        markNew = this.messageQueue.length
        if (markNew < markLast) {
          throw new Error(`It appears redpanda went backwards! markLast: ${markLast} --> ${markNew}`)
        }

        if (markNew > (markLast + numMessages)) {
          const errorMessage = `Redpanda expected to consume: ${numMessages}, but consumed: ${markNew - markLast}`
          logger.error(errorMessage)
          this.printLast(markNew - markLast)
          throw new Error(errorMessage)
        }

        if (markNew === (markLast + numMessages)) {
          const end = performance.now()
          logger.info(`Redpanda consumed ${numMessages} message${numMessages === 1 ? ' ' : 's'} after ${(end - start).toFixed(0).padStart(4)}ms.`)

          // Cool down for 20ms, check that there are no late messages.
          await new Promise(resolve => setTimeout(resolve, 20))
          const extraMessages = this.messageQueue.length - markNew
          assert(extraMessages >= 0)
          if (extraMessages !== 0) {
            const errorMessage = `After cooldown, Redpanda consumed ${extraMessages} extra message${extraMessages === 1 ? ' ' : 's'}.`
            logger.error(errorMessage)

            this.printLast(numMessages + extraMessages)
            throw new Error(errorMessage)
          }

          return
        }

        throw new Error('Not ready')
      } catch (err: any) {
        if (attempt === attempts) {
          const errorMessage = `redpandaDrain() failed to consume ${numMessages} messages after ${attempts} attempts.\
Found only ${markNew - markLast} new messages.`
          logger.error(errorMessage)
          this.printLast(markNew - markLast)

          throw new Error(errorMessage)
        }

        if (err.message !== 'Not ready') {
          logger.error(err.message)
          throw err
        }

        logger.info(`redpandaDrain() waiting for Redpanda: [attempt ${`${attempt}`.padStart(3)}/${attempts}, delayMs: ${delayMs}].`)
        // Slowly back off.
        delayMs = Math.floor((delayMs * 1.1) + 10)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
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
  public printLast(numMessages?: number): void {
    let messages = this.spoolLast(this.messageQueue.length)
    if (numMessages) {
      assert(numMessages >= 0)
      assert(numMessages <= messages.length)
      messages = messages.slice(numMessages * -1)
    }
    logger.warn('printLast() messages:')
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

  /**
   * Sometimes we just want to check the last topics that were published to.
   */
  public spoolLastTopic(numMessages: number): Array<string> {
    const last = this.spoolLast(numMessages)
    return last.map(message => message.topic)
  }

  /**
   * Get the payload of the last _n_ messages produced across all topics.
   */
  public spoolLastPayload(numMessages: number): Array<any> {
    const last = this.spoolLast(numMessages)
    return last.map(message => message.valueParsed.content.payload)
  }
}

interface DependencyOptions {
  harnessId: number,
}

interface RedpandaConnectionOptions {
  port: number
}

export type MojaloopKafkaMessage = {
  topic: string,
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

/**
 * Starts a redpanda and redpanda console docker container.
 * Redpanda is much quicker to start up than Kafka, so is more suitable for this testing harness.
 */
class Redpanda {
  private logger = logger.child({ scope: 'Redpanda' })
  private options: DependencyOptions
  private containerName: string
  private containerNameConsole: string
  private _connectionOptions: null | RedpandaConnectionOptions

  private topics = [
    'topic-transfer-prepare',
    'topic-transfer-position',
    'topic-transfer-fulfil',
    'topic-notification-event',
    'topic-admin-transfer',
    'topic-transfer-position-batch',
  ]

  constructor(options: DependencyOptions) {
    assert(options)
    assert(options.harnessId)

    this.options = options;
    this.containerName = `int_${this.options.harnessId}_redpanda`
    this.containerNameConsole = `int_${this.options.harnessId}_redpanda_console`
    this._connectionOptions = null
  }

  public async up(): Promise<void> {
    this.logger.debug(`up()`)
    const portRedpanda = await randomAvailablePort()
    const portConsole = await randomAvailablePort()

    const command = `
    docker rm -f ${this.containerName} ${this.containerNameConsole} 2>/dev/null;
    docker network create harness || echo 'harness exists';
    docker run -d \
      --name ${this.containerName} \
      --network harness \
      -p ${portRedpanda}:9092 \
      --health-cmd="rpk cluster info" \
      --health-interval=1s \
      --health-timeout=2s \
      --health-retries=100 \
      --health-start-period=2s \
      docker.io/redpandadata/redpanda:latest \
      redpanda start \
      --smp 1 \
      --memory 400M \
      --reserve-memory 0M \
      --overprovisioned \
      --node-id 0 \
      --check=false \
      --kafka-addr internal://0.0.0.0:29092,external://0.0.0.0:9092 \
      --advertise-kafka-addr internal://${this.containerName}:29092,external://localhost:${portRedpanda}
    `.replace(/\s+/g, ' ')
    const { stdout, stderr } = await execAsync(command)
    this.logger.info(`Redpanda.up() stdout: ${stdout}`)
    this.logger.info(`Redpanda.up() stderr: ${stderr}`)

    const commandConsole = `
    docker run -d \
      --name ${this.containerNameConsole} \
      --hostname ${this.containerNameConsole} \
      --restart on-failure \
      --network harness \
      -p ${portConsole}:8080 \
      -e KAFKA_BROKERS=${this.containerName}:29092 \
      docker.redpanda.com/redpandadata/console:latest
    `.replace(/\s+/g, ' ')

    await execAsync(commandConsole)

    this._connectionOptions = {
      port: portRedpanda,
    }

    this.logger.warn(`Redpanda - go to: http://localhost:${portConsole} to see the Redpanda Console`);
    await this.waitForHealthy()
    await this.createTopics()
    this.logger.debug(`up() - Complete.`)
  }

  private async waitForHealthy(): Promise<void> {
    assert(this._connectionOptions)

    let attemptsMax = 75
    let delayMs = 50

    for (let attempt = 1; attempt <= attemptsMax; attempt++) {
      try {
        const command = `docker inspect --format='{{.State.Health.Status}}' ${this.containerName}`
        const { stdout } = await execAsync(command, { silent: true })

        if (stdout.trim() !== 'healthy') {
          throw new Error('Not ready.')
        }

        logger.warn(`Redpanda started after ${attempt} attempts (${attempt * delayMs}ms).`)
        return
      } catch (err: any) {
        if (attempt === attemptsMax) {
          throw new Error(`Redpanda failed to start after ${attemptsMax} attempts.\n${err.message}`)
        }

        logger.debug(`Waiting for Redpanda: [attempt ${`${attempt}`.padStart(3)}/${attemptsMax}]`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  private async createTopics(): Promise<void> {
    logger.debug(`createTopics() - creating ${this.topics.length} kafka topics`);

    const commands = this.topics.map(topic =>
      `docker exec ${this.containerName} rpk topic create ${topic}`
    );

    await Promise.all(commands.map(async cmd => {
      await execAsync(cmd, { silent: true, force: true })
    }))
  }

  get connectionOptions(): MySqlConnectionOptions {
    if (!this._connectionOptions) {
      throw new Error(`this._connectionOptions is null. Did you forget to call up()?`)
    }
    return this._connectionOptions
  }

  public async down(): Promise<void> {
    this.logger.debug(`down() - stopping and removing containers: ${this.containerName}, ${this.containerNameConsole}.`)
    try {
      await execAsync(`docker stop ${this.containerName} ${this.containerNameConsole}`, { silent: true })
      await execAsync(`docker rm -f ${this.containerName} ${this.containerNameConsole}`, { silent: true })
      this.logger.debug(`down() - Complete.`)
    } catch (err: any) {
      this.logger.error(`down() - failed to remove containers: ${err.message}`)
      throw err
    }
  }

  /**
   * Get the sum of all watermarks across all topics.
   */
  public async mark(): Promise<number> {
    let watermarkSum = 0
    for (const topic of this.topics) {
      const cmd = `docker exec ${this.containerName} rpk topic describe ${topic} --format=json`
      const { stdout } = await execAsync(cmd)

      const describeJson = JSON.parse(stdout)[0].partitions[0]
      watermarkSum += describeJson.high_watermark
    }
    return watermarkSum;
  }
}

interface DependencyOptionsMySql extends DependencyOptions {
  databaseName: string,
  migration: MigrationOptions
}

interface MigrationOptionsKnex {
  type: 'knex';

  /**
   * If this is set, then after running the knex migration, perform a mysql dump
   * to update the migration file
   */
  updateSqlFilePath?: string
}

interface MigrationOptionsSql {
  type: 'sql';
  sqlFilePath: string;
}

type MigrationOptions = MigrationOptionsKnex | MigrationOptionsSql;

interface MySqlConnectionOptions {
  port: number
}

class MySql {
  private logger = logger.child({ scope: 'MySql' })
  private options: DependencyOptionsMySql
  private containerName: string
  private _connectionOptions: MySqlConnectionOptions | null

  constructor(options: DependencyOptionsMySql) {
    assert(options)
    assert(options.harnessId)

    this.options = options;
    this.containerName = `int_${this.options.harnessId}_mysql`
    this._connectionOptions = null
  }

  public async up(): Promise<void> {
    this.logger.debug(`up()`)
    const port = await randomAvailablePort()

    const command = `
    docker rm -f ${this.containerName} 2>/dev/null;
    docker run -d \
      --name ${this.containerName} \
      --tmpfs /var/lib/mysql:rw,size=256m \
      -e MARIADB_ROOT_PASSWORD=password \
      -e MARIADB_DATABASE=${this.options.databaseName} \
      -p ${port}:3306 \
      mariadb:latest
    `.replace(/\s/g, ' ')
    await execAsync(command)

    this.logger.info(`MySql starting at localhost:${port}`);

    this._connectionOptions = { port }
    await this.waitForMySqlReady()
    await this.migrate()
    await this.seed()

    this.logger.debug(`up() - Complete.`)
  }

  get connectionOptions(): MySqlConnectionOptions {
    if (!this._connectionOptions) {
      throw new Error(`this._connectionOptions is null. Did you forget to call up()?`)
    }
    return this._connectionOptions
  }

  public async down(): Promise<void> {
    this.logger.debug(`down() - stopping and removing containers: ${this.containerName}.`)
    try {
      await execAsync(`docker stop ${this.containerName}`, { silent: true })
      await execAsync(`docker rm -f ${this.containerName}`, { silent: true })
      this.logger.debug(`down() - Complete.`)
    } catch (err: any) {
      this.logger.error(`down() - failed to remove containers: ${err.message}`)
      throw err
    }
  }

  /**
   * Call exec on the container to make sure mysql is ready for connections.
   */
  private async waitForMySqlReady(): Promise<void> {
    assert(this._connectionOptions)

    let attemptsMax = 150
    let delayMs = 35

    for (let attempt = 1; attempt <= attemptsMax; attempt++) {
      try {
        const command = `docker exec ${this.containerName} sh -c \
          'mariadb -u root -ppassword -e "select 1" ${this.options.databaseName}'
        `
        await execAsync(command)
        logger.warn(`MySql started after ${attempt} attempts (${attempt * delayMs}ms).`)
        return
      } catch (err: any) {
        if (attempt === attemptsMax) {
          throw new Error(`MySql failed to start after ${attemptsMax} attempts.\n${err.message}`)
        }
        // Extra whitespace for better printing.
        logger.debug(`Waiting for MySQL:      [attempt ${`${attempt}`.padStart(3)}/${attemptsMax}]`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  private async migrate(): Promise<void> {
    assert(this._connectionOptions)

    // Sometimes migration fails even if MySQL is ready, so we wrap this in retries.
    let attemptsMax = 3
    let delayMs = 1000

    for (let attempt = 1; attempt <= attemptsMax; attempt++) {
      try {
        const type = this.options.migration.type
        switch (type) {
          case "knex": 
            await this.migrateKnex()
            break;
          case "sql": 
            await this.migrateSql()
            break
          default: 
            throw new Error(`Unexpected migration type: ${type}`)
        }
      } catch (err: any) {
        if (attempt === attemptsMax) {
          throw new Error(`migrate failed after ${attemptsMax}.\n${err.message}`)
        }
        logger.debug(`migrate()          [attempt ${`${attempt}`.padStart(3)}/${attemptsMax}]`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  private getKnexClient() {
    return knex({
      client: 'mysql2',
      connection: {
        host: 'localhost',
        port: this.connectionOptions.port,
        user: 'root',
        password: 'password',
        database: this.options.databaseName,
      },
      migrations: {
        tableName: 'migration',
        directory: './src/migrations'
      },
      seeds: {
        directory: './src/seeds'
      }
    })
  }

  /**
   * @method migrateKnex()
   * @description Runs all of the knex migrations. It's quite slow so you probably want to use
   *   migrateSql() to restore the databse from the checkpoint sql file, and check that file into
   *   git.
   */
  private async migrateKnex(): Promise<void> {
    assert(this.options.migration.type === 'knex')

    const knexClient = this.getKnexClient();
    try {
      await knexClient.migrate.latest()
      logger.debug('migrateKnex() - complete.')

      if (this.options.migration.updateSqlFilePath) {
        await this.saveDatabaseCheckpoint(this.options.migration.updateSqlFilePath)
      }
    } finally {
      await knexClient.destroy()
    }
  }

  private async saveDatabaseCheckpoint(pathToCheckpoint: string): Promise<void> {
    try {
      logger.info(`saveDatabaseCheckpoint() - creating checkpoint at: ${pathToCheckpoint}`)

      // Dump the database inside the container to a known location.
      const containerTempFile = '/tmp/checkpoint_dump.sql'
      const dumpCmd = `docker exec ${this.containerName} sh -c \
        'mariadb-dump -u root -ppassword ${this.options.databaseName} > ${containerTempFile}'`;
      const { stderr: dumpStderr } = await execAsync(dumpCmd);

      if (dumpStderr && !dumpStderr.includes('Warning: Using a password')) {
        logger.warn('SQL dump warnings:', dumpStderr);
      }

      const copyCmd = `docker cp ${this.containerName}:${containerTempFile} ${pathToCheckpoint}`;
      const { stderr: copyStderr } = await execAsync(copyCmd);

      if (copyStderr) {
        logger.warn('Docker copy warnings:', copyStderr);
      }

      const addNoticeCmd = `echo "-- Note: This file was generated by ./testing/harness.ts.
      -- It is used to speed up the integration tests, but needs to be recreated every time a new
      -- migration is added. Refer to ./src/testing/harness.ts for instructions of how to update this
      -- snapshot.
      " > /tmp/checkpoint; \
        cat ${pathToCheckpoint} >> /tmp/checkpoint; \
      `.replace(/\ {2,}/g, '')
      await execAsync(addNoticeCmd, { silent: false })

      await execAsync(`mv /tmp/checkpoint ${pathToCheckpoint}`)
      logger.info(`SQL checkpoint saved to ${pathToCheckpoint}`)

    } catch (err: any) {
      logger.error(`saveDatabaseCheckpoint() failed with error: ${err.message}`)
      throw err
    }
  }

  private async migrateSql(): Promise<void> {
    assert(this.options.migration.type === 'sql')

    try {
      logger.debug(`migrateSql(): from: ${this.options.migration.sqlFilePath}.`)
      const cmd = `docker cp ${this.options.migration.sqlFilePath} ${this.containerName}:/tmp/checkpoint.sql && \
        docker exec -i ${this.containerName} sh -c 'mariadb -u root -ppassword ${this.options.databaseName} < /tmp/checkpoint.sql'
      `
      const { stdout, stderr } = await execAsync(cmd);

      if (stderr && !stderr.includes('warning')) {
        logger.debug('migrateSql() warnings:', stderr);
      }

      logger.debug(`migrateSql() from ${this.options.migration.sqlFilePath} completed`);
    } catch (err: any) {
      throw new Error(`migrateSql() from: ${this.options.migration.sqlFilePath} failed with error: ${err.message}.`)
    }
  }

  private async seed(): Promise<void> {
    const knexClient = this.getKnexClient();
    try {
      await knexClient.seed.run()
      logger.debug('seed() - complete.')
    } finally {
      await knexClient.destroy()
    }
  }
}

interface DependencyOptionsRedis extends DependencyOptions {
}

interface RedisConnectionOptions {
  port: number
}

class Redis {
  private logger = logger.child({ scope: 'Redis' })
  private containerName: string
  private _connectionOptions: RedisConnectionOptions | null

  constructor(private options: DependencyOptionsRedis) {
    assert(options)
    assert(options.harnessId)

    this.containerName = `int_${this.options.harnessId}_redis`
    this._connectionOptions = null
  }

  public async up(): Promise<void> {
    this.logger.debug(`up()`)
    const port = await randomAvailablePort()

    const command = `
    docker rm -f ${this.containerName} 2>/dev/null;
    docker run -d \
      --name ${this.containerName} \
      -p ${port}:6379  \
      -e ALLOW_EMPTY_PASSWORD=yes \
      --health-cmd "redis-cli ping" \
      --health-timeout 2s \
      --health-interval 10s \
      redis:latest
    `.replace(/\s/g, ' ')
    await execAsync(command)

    this.logger.info(`Redis starting at localhost:${port}`);

    this._connectionOptions = { port }

    this.logger.debug(`up() - Complete.`)
  }

  get connectionOptions() {
    if (!this._connectionOptions) {
      throw new Error(`this._connectionOptions is null. Did you forget to call up()?`)
    }
    return this._connectionOptions
  }

  public async down(): Promise<void> {
    this.logger.debug(`down() - stopping and removing containers: ${this.containerName}.`)
    try {
      await execAsync(`docker stop ${this.containerName}`, { silent: true })
      await execAsync(`docker rm -f ${this.containerName}`, { silent: true })
      this.logger.debug(`down() - Complete.`)
    } catch (err: any) {
      this.logger.error(`down() - failed to remove containers: ${err.message}`)
      throw err
    }
  }
}