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

// STUFF TO GO IN HERE FOR RE-USABLE CONSUMING
var async = require('async')
const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../lib/config')
// const kafkaLogging = require('kafka-node/logging')
// const getLoggerProvider = {
//   debug: console.log.bind(Logger),
//   info: console.log.bind(Logger),
//   warn: console.log.bind(Logger),
//   error: console.log.bind(Logger)
// }
// kafkaLogging.setLoggerProvider(getLoggerProvider)
const kafkanode = require('kafka-node')
const Consumer = kafkanode.Consumer
const Client = kafkanode.Client
const kafka = require('./index')
const Commands = require('../commands')

var CronJob = require('cron').CronJob

const createConsumer = (clientId, funcProcessMessage, topic, options) => {
  Logger.info(`kafkaConsumer::['${clientId}'] Creating Kafka Consumer funcProcessMessage:'${funcProcessMessage.name || 'anonymousFunc'}''`)

  var topicList = [{
    topic: topic,
    partition: 0
  }]

  const client = new Client(Config.TOPICS_KAFKA_HOSTS, clientId)

  Logger.info(`kafkaConsumer::['${clientId}'] ready for Consumption for ${JSON.stringify(topicList)}`)

  var consumer = new Consumer(
    client,
    topicList,
    options
  )

  var q = async.queue(function (message, cb) {
    var payload = JSON.parse(message.value)
    funcProcessMessage(payload).then(result => {
      if (result) {
        // Logger.info('result: %s', result)
        consumer.commit(
          function (err, result) {
            if (err) {
              Logger.info(`kafkaConsumer::['${clientId}'] Committing index error: ${JSON.stringify(err)}`)
            }
            Logger.info(`kafkaConsumer::['${clientId}'] Committing index`)
          })
        cb() // this marks the completion of the processing by the worker
      }
    }).catch(reason => {
      Logger.error(`kafkaConsumer::['${clientId}'] funcProcessMessage(${funcProcessMessage.name}) failed with the following reason: ${reason}`)
      cb()
    })
  }, 1)

  // a callback function, invoked when queue is empty.
  q.drain = function () {
    consumer.resume()
  }

  consumer.on('message', (message) => {
    Logger.info(`kafkaConsumer::['${clientId}'] Consumed message: ${JSON.stringify(message)}`)
    q.push(message, function (err, result) {
      if (err) {
        Logger.error(err)
        return
      }
    })
    consumer.pause() // Pause kafka consumer group to not receive any more new messages
  })

  consumer.on('error', function (err) {
    Logger.error(`kafkaConsumer::['${clientId}'] ERROR: ${err}`)
  })
}

const setClientId = (topic) => {
  return topic
}

const kafkaConsumers = async (funcProcessMessage, topicRegexFilter, options, config) => {
  Logger.info(`kafkaConsumer:: Creating Kafka Consumer funcProcessMessage:'${funcProcessMessage.name || 'anonymousFunc'}', topicRegexFilter:'${topicRegexFilter}'`)

  await kafka.getListOfFilteredTopics(topicRegexFilter).then(listOfPreparedTopics => {
    var templistOfPreparedTopics = listOfPreparedTopics
    // Logger.info(`List of Topics for for Prepare= ${listOfPreparedTopics}`)
    // return new Promise((resolve, reject) => {
    templistOfPreparedTopics.forEach(topic => {
      var clientId = setClientId(topic)
      Logger.info(`kafkaConsumer:: Creating Kafka Consumer with ClientId=['${clientId}']`)
      createConsumer(clientId, funcProcessMessage, topic, options)
    })

    const reLoadConsumersJob = new CronJob(config.pollingCronTab, function () {
      Logger.info(`kafkaConsumer:: Polling for new Topics on regex: '${topicRegexFilter}'`)
      kafka.getListOfFilteredTopics(topicRegexFilter).then(refreshedListOfPreparedTopics => {
        Logger.info(`kafkaConsumer:: Existing Consumers for regex: '${topicRegexFilter}' = ${JSON.stringify(refreshedListOfPreparedTopics)}`)
        var difference = refreshedListOfPreparedTopics.filter(x => !templistOfPreparedTopics.includes(x))
        // Logger.info(`kafkaConsumer:: adding new Topics for Consumption for ${JSON.stringify(difference)}`)
        templistOfPreparedTopics = refreshedListOfPreparedTopics
        if (difference && difference.length) {
          Logger.info(`kafkaConsumer:: Poller for '${topicRegexFilter}' found new Topics...${JSON.stringify(difference)}`)
          templistOfPreparedTopics.forEach(topic => {
            var clientId = setClientId(topic)
            Logger.info(`kafkaConsumer:: Poller '${topicRegexFilter}' creating Kafka Consumer with ClientId=['${clientId}']`)
            createConsumer(clientId, funcProcessMessage, topic, options)
          })
        }
      })
    }, null, true, config.pollingTimeZone)
  }).catch(reason => {
    Logger.error(`kafkaConsumer:: Poller '${topicRegexFilter}' Unable to fetch list topics with regex topicRegexFilter(${topicRegexFilter}) with the following reason: ${reason}`)
  })
}
//
// exports.register = (server, options, next) => {
//   const kafkaOptions = Config.TOPICS_KAFKA_CONSUMER_OPTIONS
//   const kafkaConfig = Config.TOPICS_KAFKA_CONSUMER_CONFIG
//
//   kafkaConsumers(Commands.prepareExecute, Config.TOPICS_PREPARE_TX_REGEX, kafkaOptions, kafkaConfig)
//   kafkaConsumers((msg) => {
//     return new Promise((resolve, reject) => {
//       Logger.info(`Message process for Notifications ${JSON.stringify(msg)}`)
//       return resolve(true)
//     })
//   }, Config.TOPICS_PREPARE_NOTIFICATION_REGEX, kafkaOptions, kafkaConfig)
//   next()
// }
//
// exports.register.attributes = {
//   name: 'consume.message'
// }
