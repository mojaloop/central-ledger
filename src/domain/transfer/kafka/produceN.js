/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

'use strict'

const Logger = require('@mojaloop/central-services-shared').Logger
const NProducer = require('sinek').NProducer
const Config = require('../../../lib/config')
var crypto = require('crypto')

let clientId
const getClientId = () => {
  if (!clientId) {
    const randomHash = crypto.randomBytes(5).toString('hex')
    clientId = `${Config.TOPICS_KAFKA_PRODUCER_OPTIONS['client.id'] || 'default-client'}-${randomHash}`
  }
  // const clientId = `${Config.TOPICS_KAFKA_PRODUCER_OPTIONS['client.id'] || 'default-client'}-${id}`
  return clientId
}

// let producer

const connect = (options = {requiredAcks: -1, partitionCount: 1}) => {
  Logger.info(`Producer::connect - clientId='${options['client.id']}'`)

  var config = {
    logger: Logger,
    noptions: {
      // 'debug': options['debug'] || 'all',
      'metadata.broker.list': options['metadata.broker.list'],
      'client.id': getClientId() || 'default-client',
      'event_cb': true,
      'compression.codec': options['compression.codec'] || 'none',
      'retry.backoff.ms': options['retry.backoff.ms'] || 200,
      'message.send.max.retries': options['message.send.max.retries'] || 10,
      'socket.keepalive.enable': options['socket.keepalive.enable'] || true,
      'queue.buffering.max.messages': options['queue.buffering.max.messages'] || 100000,
      'queue.buffering.max.ms': options['queue.buffering.max.ms'] || 1000,
      'batch.num.messages': options['batch.num.messages'] || 1000000,

      // 'security.protocol': 'sasl_ssl',
      // 'ssl.key.location': path.join(__dirname, '../certs/ca-key'),
      // 'ssl.key.password': 'nodesinek',
      // 'ssl.certificate.location': path.join(__dirname, '../certs/ca-cert'),
      // 'ssl.ca.location': path.join(__dirname, '../certs/ca-cert'),
      // 'sasl.mechanisms': 'PLAIN',
      // 'sasl.username': 'admin',
      // 'sasl.password': 'nodesinek',

      'api.version.request': true
    },
    tconf: {
      // 0=Broker does not send any response/ack to client, 1=Only the leader broker will need to ack the message, -1 or all=broker will block until message is committed by all in sync replicas (ISRs) or broker's min.insync.replicas setting before sending response.
      'request.required.acks': options.requiredAcks || 1
    }
  }

  if (options.debug) {
    config.noptions.debug = 'all'
  }

  const producer = new NProducer(config, options.partitionCount || 1)

  return producer
}

const send = (options = {message, topic, partition: 0, key: null, partitionKey: null}) => {
  const kafkaProducerOptions = Config.TOPICS_KAFKA_PRODUCER_OPTIONS

  const producer = connect(kafkaProducerOptions)

  const {message, topic, partition, key, partitionKey} = options
  return new Promise((resolve, reject) => {
    Logger.info(`Producer::send - message='${message}', topic=''${topic}, partition='${partition}', key='${key}', partitionKey='${partitionKey}'`)

    producer.on('error', error => {
      Logger.error(`Producer::send - ERROR=${error}`)
      producer.close()
      return reject(error)
    })

    producer.connect().then(() => {
      Logger.info(`Producer::send key='${key}' - connected.`)
      producer.send(topic, message, partition, key, partitionKey).then(result => {
        Logger.info(`Producer::send key='${key}' - send - result='${JSON.stringify(result)}'`)
        // producer.close()
        return resolve(result)
      })
    }).catch(error => {
      Logger.error(`Producer::send - ERROR=${error}`)
      producer.close()
      return reject(error)
    })
  })
}

const stats = () => {}

// let producer
//
// const connect = (options = {requiredAcks: -1, partitionCount: 1}) => {
//   Logger.info(`Producer::connect - clientId='${options['client.id']}'`)
//
//   var config = {
//     logger: Logger,
//     noptions: {
//       // 'debug': options['debug'] || 'all',
//       'metadata.broker.list': options['metadata.broker.list'],
//       'client.id': Kafka.getClientId() || 'default-client',
//       'event_cb': true,
//       'compression.codec': options['compression.codec'] || 'none',
//       'retry.backoff.ms': options['retry.backoff.ms'] || 200,
//       'message.send.max.retries': options['message.send.max.retries'] || 10,
//       'socket.keepalive.enable': options['socket.keepalive.enable'] || true,
//       'queue.buffering.max.messages': options['queue.buffering.max.messages'] || 100000,
//       'queue.buffering.max.ms': options['queue.buffering.max.ms'] || 1000,
//       'batch.num.messages': options['batch.num.messages'] || 1000000,
//
//       // 'security.protocol': 'sasl_ssl',
//       // 'ssl.key.location': path.join(__dirname, '../certs/ca-key'),
//       // 'ssl.key.password': 'nodesinek',
//       // 'ssl.certificate.location': path.join(__dirname, '../certs/ca-cert'),
//       // 'ssl.ca.location': path.join(__dirname, '../certs/ca-cert'),
//       // 'sasl.mechanisms': 'PLAIN',
//       // 'sasl.username': 'admin',
//       // 'sasl.password': 'nodesinek',
//
//       'api.version.request': true
//     },
//     tconf: {
//       // 0=Broker does not send any response/ack to client, 1=Only the leader broker will need to ack the message, -1 or all=broker will block until message is committed by all in sync replicas (ISRs) or broker's min.insync.replicas setting before sending response.
//       'request.required.acks': options.requiredAcks || 1
//     }
//   }
//
//   if (options.debug) {
//     config.noptions.debug = 'all'
//   }
//
//   producer = new NProducer(config, options.partitionCount || 1)
// }
//
// const send = (options = {message, topic, partition: 0, key: null, partitionKey: null}) => {
//   const {message, topic, partition, key, partitionKey} = options
//   return new Promise((resolve, reject) => {
//     Logger.info(`Producer::send - message='${message}', topic=''${topic}, partition='${partition}', key='${key}', partitionKey='${partitionKey}'`)
//
//     producer.on('error', error => {
//       Logger.error(`Producer::send - ERROR=${error}`)
//       // producer.close()
//       return reject(error)
//     })
//
//     producer.connect().then(() => {
//       Logger.info(`Producer::send key='${key}' - connected.`)
//       producer.send(topic, message, partition, key, partitionKey).then(result => {
//         Logger.info(`Producer::send key='${key}' - send - result='${JSON.stringify(result)}'`)
//         // producer.close()
//         return resolve(result)
//       })
//     }).catch(error => {
//       Logger.error(`Producer::send - ERROR=${error}`)
//       // producer.close()
//       return reject(error)
//     })
//   })
// }
//
// const stats = () => {
//   // if(producer.isc
//   var stats = producer.getStats()
//   Logger.info('Producer::stats %j', stats)
//   return stats
//   // Logger.info('%j',health)
// }

// connect('test-client', {requiredAcks: -1, partitionCount: 1})
// connect('test-client')
// connect('test-client')

// send('test1', 'test').then(result => Logger.info('OH YES %j', result))

// send('test2', 'test').then(result => Logger.info('OH YES!!! %j', result))

const publishHandler = (event) => {
  return async (eventMessage) => {
    const { topic, key, msg } = eventMessage
    Logger.info('Kafka.publish.publishHandler:: start(%s, %s, %s)', topic, key, msg)

    await send({topic, key, message: msg}).then(results => {
      Logger.info(`Kafka.publish.publishHandler:: result:'${results}'`)
    })
  }
}

exports.connect = connect
exports.send = send
exports.stats = stats
exports.publishHandler = publishHandler
