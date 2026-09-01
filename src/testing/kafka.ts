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

import Kafka from 'node-rdkafka'
import assert from "node:assert"
import Logger from "@mojaloop/central-services-logger"

const logger = Logger.child({ scope: 'testing/kafka' })

export class Producer {
  private _producer: Kafka.HighLevelProducer
  private _status: 'SETUP' | 'READY' | 'ERROR' | 'DISCONNECTED' = 'SETUP'

  constructor(broker: string) {
    this._producer = new Kafka.HighLevelProducer({
      'metadata.broker.list': broker
    })
    // Seemed to be a good number in our local benchmarks.
    this._producer.setPollInterval(50)
  }

  async connect(onError: (err: Kafka.LibrdKafkaError) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this._producer.connect({}, (err, data) => {
        if (err) {
          this._status = 'ERROR'
          logger.error(`Producer.connect() failed with error: ${err.message}.`)
          return reject(err)
        }
      })

      this._producer.on('ready', () => {
        this._status = 'READY'
        return resolve()
      })

      this._producer.on('event.error', (err) => {
        logger.error(`Producer on 'event.error': ${err.message}`)
        onError(err)
      })

      this._producer.setValueSerializer((value) => Buffer.from(value))
    })
  }

  async disconnect(): Promise<void> {
    assert.equal(this._status, 'READY', 'Producer is not ready. Did you call `connect()`?')

    return new Promise((resolve, reject) => {
      this._producer.on('disconnected', () => {
        resolve()
      })
      this._producer.flush()
      this._producer.disconnect()
    })
  }

  /**
   * Produce a set of messages to a topic.
   */
  async produce(topic: string, messages: Array<any>): Promise<void> {
    assert.equal(this._status, 'READY', 'Producer is not ready. Did you call `connect()`?')

    const producePromise = (message: any): Promise<void> => new Promise((resolve, reject) => {
      // Adding this into the hot path to more closely mimick the legacy kafka behaviour.
      const messageStr = JSON.stringify(message)
      this._producer.produce(topic, null, messageStr, null, Date.now(), (err, offset) => {

        if (err) {
          return reject(err)
        }
        return resolve()
      })
    })
    const messagePromises = Promise.all(messages.map(message => producePromise(message)))
    await messagePromises
  }
}

export class Consumer {
  private _consumer: Kafka.KafkaConsumer
  private _status: 'CREATED' | 'SUBSCRIBING' | 'CONSUMING' | 'ERRORED' | 'DISCONNECTED' = 'CREATED'

  constructor(group: string, broker: string) {
    assert(group)
    assert(broker)

    this._consumer = new Kafka.KafkaConsumer({
      'group.id': group,
      'enable.auto.commit': false,
      'metadata.broker.list': broker,
      'session.timeout.ms': 6000,
      'heartbeat.interval.ms': 2000,
      'socket.timeout.ms': 5000,
      'fetch.wait.max.ms': 500,
    }, {
      'auto.offset.reset': 'earliest'
    })
  }

  public async subscribe(topics: Array<string | RegExp>, cb: (msg: Kafka.Message) => void): Promise<void> {
    logger.debug(`Consumer.subscribe()`)

    if (this._status !== 'CREATED') {
      throw new Error(`Consumer.subscribe() - tried to subscribe but status was: ${this._status}.\
        Expectected status: 'CREATED'.`)
    }
    this._status = 'SUBSCRIBING'
    return new Promise((resolve, reject) => {
      this._consumer.connect()

      this._consumer.on('ready', (info, metadata) => {
        this._consumer.subscribe(topics)
        this._consumer.consume()
        this._status = 'CONSUMING'
        logger.debug(`Consumer subscribed and ready.`)
        return resolve()
      })

      this._consumer.on('data', (msg) => {
        return cb(msg)
      })

      this._consumer.on('event.error', (error: Kafka.LibrdKafkaError) => {
        logger.error(`Consumer.on('event.error'): ${error.message}.`)
      })

      this._consumer.on('connection.failure', (err) => {
        this._status = 'ERRORED'
        logger.error('connection failure', err);
      });

      this._consumer.on('event.log', (log) => {
        logger.info(log);
      });

      this._consumer.on('disconnected', (msg) => {
        this._status = 'DISCONNECTED'
        logger.info('disconnected', msg);
      })
      
      this._consumer.on('rebalance', (err, assignments) => {
        logger.error('rebalance', err);
      })
    })
  }

  /**
   * Disconnect the consumer. Noop if not already consuming.
   */
  public async disconnect(): Promise<void> {
    logger.info(`Consumer.disconnect()`)
    const connected = this._consumer.isConnected()
    
    if (!connected) {
      logger.warn('Consumer already disconnected')
      this._status = 'DISCONNECTED'
      return
    }

    if (this._status !== 'CONSUMING') {
      logger.warn(`Consumer.disconnect() called but status was: ${this._status}. Treating as a noop.`)
      return
    }

    const assignments = this._consumer.assignments()
    if (assignments.length > 0) {
      this._consumer.pause(assignments)
    }

    this._consumer.unsubscribe()

    const timeoutMs = 10000
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const error = new Error(`Consumer.disconnect() timed out after: ${timeoutMs} ms`)
        logger.error(error.message)
        reject(error)
      }, timeoutMs)
      logger.info('calling _consumer.disconnect()')
      
      this._consumer.disconnect((err: any, data: Kafka.ClientMetrics) => {

        logger.info('_consumer.disconnect - callback!')
        clearTimeout(timeout)
        if (err) {
          this._status = 'ERRORED'
          return reject(err)
        }

        this._status = 'DISCONNECTED'
        return resolve()
      })
    })
  }
}

