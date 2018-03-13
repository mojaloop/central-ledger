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

 * Lazola Lucas <lazola.lucas@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

'use strict'

const debug = require('debug')
const Logger = require('@mojaloop/central-services-shared').Logger
// const path = require('path')
const Config = require('../../../lib/config')
const {
  NConsumer
} = require('sinek')
var CronJob = require('cron').CronJob
const kafka = require('./index')

// const logger = {
//   debug: debug('sinek:debug'),
//   info: debug('sinek:info'),
//   warn: debug('sinek:warn'),
//   error: debug('sinek:error')
// }
// const ConsumerOnceOff = () => {}

const ConsumerOnceOff = (groupId, topic, funcProcessMessage) => {
  return new Promise((resolve, reject) => {
    Logger.info(`ConsumerOnceOff::['${topic}'] - starting`)
    const config = {
      logger: Logger,
      noptions: {
        'debug': 'all',
        'metadata.broker.list': 'localhost:9092',
        'group.id': groupId,
        // 'enable.auto.commit': false,
        'event_cb': true,
        'compression.codec': 'none',
        'retry.backoff.ms': 200,
        'message.send.max.retries': 10,
        'socket.keepalive.enable': true,
        'queue.buffering.max.messages': 100000,
        'queue.buffering.max.ms': 1000,
        'batch.num.messages': 1000000,
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
        'auto.offset.reset': 'earliest'
        // 'auto.offset.reset': 'latest'
      }
    }

    const consumerConfig = {
      // batchSize: 1, // grab up to 500 messages per batch round
      // commitEveryNBatch: 1, // commit all offsets on every 5th batch
      concurrency: 1, // calls synFunction in parallel * 2 for messages in batch
      commitSync: true, // commits asynchronously (faster, but potential danger of growing offline commit request queue) => default is true
      noBatchCommits: false // default is false, IF YOU SET THIS TO true THERE WONT BE ANY COMMITS FOR BATCHES
    }

    const consumer = new NConsumer(topic, config)

    consumer.on('error',
      error => {
        config.logger.error(`ConsumerOnceOff::['${topic}'] - ERROR: ${error}`)
        consumer.close(true)
        return reject(error)
      }
    )

    consumer.connect().then(() => {
      config.logger.info(`Consumer::['${topic}'] - connected`)
      consumer.consume(funcProcessMessage, true, false, consumerConfig)
    }).catch(error => {
      config.logger.error(error)
      consumer.close(true)
      return reject(error)
    })

    /* Streaming Mode */
    // consumer.connect(true, {asString: true, asJSON: false}).then(() => {
    //   config.logger.info('connected')
    // }).catch(error => config.logger.error(error))

    consumer.on('message', message => {
      config.logger.info(`ConsumerOnceOff::['${topic}'] - message.offset='${message.offset}', message.value='${message.value}'`)
      config.logger.info(`ConsumerOnceOff::['${topic}'] - stats=${JSON.stringify(consumer.getStats())}`)
      // consumer.close(true)
      return resolve(message)
    })
  })
}

const Consumer = (groupId, topic, funcProcessMessage) => {
  Logger.info(`Consumer::['${topic}'] - starting`)
  const config = {
    logger: Logger,
    noptions: {
      'debug': 'all',
      'metadata.broker.list': 'localhost:9092',
      'group.id': groupId,
      // 'enable.auto.commit': false,
      'event_cb': true,
      'compression.codec': 'none',
      'retry.backoff.ms': 200,
      'message.send.max.retries': 10,
      'socket.keepalive.enable': true,
      'queue.buffering.max.messages': 100000,
      'queue.buffering.max.ms': 1000,
      'batch.num.messages': 1000000,
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
      'auto.offset.reset': 'earliest'
      // 'auto.offset.reset': 'latest'
    }
  }

  const consumerConfig = {
    // batchSize: 1, // grab up to 500 messages per batch round
    // commitEveryNBatch: 1, // commit all offsets on every 5th batch
    concurrency: 1, // calls synFunction in parallel * 2 for messages in batch
    commitSync: true, // commits asynchronously (faster, but potential danger of growing offline commit request queue) => default is true
    noBatchCommits: false // default is false, IF YOU SET THIS TO true THERE WONT BE ANY COMMITS FOR BATCHES
  }

  const consumer = new NConsumer(topic, config)

  consumer.on('error',
      error => config.logger.error(`Consumer::['${topic}'] - ERROR: ${error}`)
  )

  // const syncFunction = (payload, cb, func = funcProcessMessage) => {
  //   return funcProcessMessage(payload).then((result) => {
  //     Logger.info('WEUWUEUWEUWEUEWU')
  //     cb()
  //   })
  // }

  consumer.connect().then(() => {
    config.logger.info(`Consumer::['${topic}'] - connected`)
    consumer.consume(funcProcessMessage, true, false, consumerConfig)
  }).catch(error => config.logger.error(error))

  /* Streaming Mode */
  // consumer.connect(true, {asString: true, asJSON: false}).then(() => {
  //   config.logger.info('connected')
  // }).catch(error => config.logger.error(error))

  consumer.on('message', message => {
    config.logger.info(`Consumer::['${topic}'] - message.offset='${message.offset}', message.value='${message.value}'`)
    config.logger.info(`Consumer::['${topic}'] - stats=${JSON.stringify(consumer.getStats())}`)
    // funcProcessMessage(message).then(result => {
    //   Logger.info(`funcProcessMessage = ${result}`)
    //   return new Promise((resolve, reject) => {
    //     resolve(true)
    //   })
    // })
  })
}

const createConsumer = async (funcProcessMessage, topicRegexFilter, options, config) => {
  Logger.info(`kafkaConsumer:: Creating Kafka Consumer funcProcessMessage:'${funcProcessMessage.name || 'anonymousFunc'}', topicRegexFilter:'${topicRegexFilter}'`)

  await kafka.getListOfFilteredTopics(topicRegexFilter).then(listOfPreparedTopics => {
    var templistOfPreparedTopics = listOfPreparedTopics
    // Logger.info(`List of Topics for for Prepare= ${listOfPreparedTopics}`)
    // return new Promise((resolve, reject) => {
    templistOfPreparedTopics.forEach(topic => {
      // var clientId = setClientId(topic)
      var groupId = options.groupId
      // Logger.info(`kafkaConsumer:: Creating Kafka Consumer with ClientId=['${clientId}']`)
      Logger.info(`kafkaConsumer:: Creating Kafka Consumer with Topic=['${topic}']`)
      Consumer(groupId, topic, funcProcessMessage)
    })

    const reLoadConsumersJob = new CronJob(config.pollingCronTab, function () {
      Logger.info(`kafkaConsumer.reLoadConsumersJob:: Polling for new Topics on regex: '${topicRegexFilter}'`)
      kafka.getListOfFilteredTopics(topicRegexFilter).then(refreshedListOfPreparedTopics => {
        Logger.info(`kafkaConsumer.reLoadConsumersJob:: Existing Consumers for regex: '${topicRegexFilter}' = ${JSON.stringify(refreshedListOfPreparedTopics)}`)
        var difference = refreshedListOfPreparedTopics.filter(x => !templistOfPreparedTopics.includes(x))
        // Logger.info(`kafkaConsumer:: adding new Topics for Consumption for ${JSON.stringify(difference)}`)
        templistOfPreparedTopics = refreshedListOfPreparedTopics
        if (difference && difference.length) {
          Logger.info(`kafkaConsumer.reLoadConsumersJob:: Poller for '${topicRegexFilter}' found new Topics...${JSON.stringify(difference)}`)
          templistOfPreparedTopics.forEach(topic => {
            // var clientId = setClientId(topic)
            var groupId = options.groupId
            Logger.info(`kafkaConsumer.reLoadConsumersJob:: Poller '${topicRegexFilter}' creating Kafka Consumer with Topic=['${topic}']`)
            Consumer(groupId, topic, funcProcessMessage)
          })
        }
      }).catch(reason => {
        Logger.error(`kafkaConsumer.reLoadConsumersJob:: ERROR= ${reason}`)
      })
    }, null, true, config.pollingTimeZone)
  }).catch(reason => {
    Logger.error(`kafkaConsumer:: Poller '${topicRegexFilter}' Unable to fetch list topics with regex topicRegexFilter(${topicRegexFilter}) with the following reason: ${reason}`)
  })
}

// var topic = 'topic-dfsp1-prepare-tx'

// Consumer('test', topic, async (message, cb) => {
//   Logger.info(`message received ${JSON.stringify(message)}`)
//   cb()
//   return true
// })

// const kafkaOptions = Config.TOPICS_KAFKA_CONSUMER_OPTIONS
// // const kafkaConfig = Config.TOPICS_KAFKA_CONSUMER_CONFIG
//
// createConsumer(async (message, cb) => {
//   Logger.info(`message received ${JSON.stringify(message)}`)
//   cb()
//   return true
// }, Config.TOPICS_PREPARE_TX_REGEX, kafkaOptions)

exports.createConsumer = createConsumer
exports.ConsumerOnceOff = ConsumerOnceOff
