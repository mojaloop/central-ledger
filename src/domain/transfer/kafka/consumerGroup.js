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

var async = require('async')
const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../lib/config')
const kafka = require('./index')
const Commands = require('../commands')
const kafkanode = require('kafka-node')
// const Consumer = kafkanode.Consumer
// const Client = kafkanode.Client
var CronJob = require('cron').CronJob

const createOnceOffConsumerGroup = async (groupId, funcProcessMessage, topics, options) => {
  var localOptions = {
    // host: 'localhost:2181',  // zookeeper host omit if connecting directly to broker (see kafkaHost below)
    kafkaHost: 'localhost:9092', // connect directly to kafka broker (instantiates a KafkaClient)
    // zk: undefined,   // put client zk settings if you need them (see Client)
    // batch: undefined, // put client batch settings if you need them (see Client)
    // ssl: true, // optional (defaults to false) or tls options hash
    groupId: groupId,
    sessionTimeout: 15000,
    // An array of partition assignment protocols ordered by preference.
    // 'roundrobin' or 'range' string for built ins (see below to pass in custom assignment protocol)
    // protocol: ['roundrobin'],
    // Offsets to use for new groups other options could be 'earliest' or 'none' (none will emit an error if no offsets were saved)
    // equivalent to Java client's auto.offset.reset
    fromOffset: 'earliest', // default
    autoCommit: false,
    // how to recover from OutOfRangeOffset error (where save offset is past server retention) accepts same value as fromOffset
    outOfRangeOffset: 'earliest' // default
    // migrateHLC: false,    // for details please see Migration section below
    // migrateRolling: true
  }
  // var localOptions = options

  var consumer = new kafkanode.ConsumerGroup(localOptions, topics)

  var q = async.queue(function (message, cb) {
    var payload = JSON.parse(message.value)
    funcProcessMessage(payload).then(result => {
      if (result) {
        // Logger.info('result: %s', result)
        consumer.commit(
          function (err, result) {
            if (err) {
              Logger.info(`consumerGroup::['${topics}'] Committing index error: ${JSON.stringify(err)}`)
              // cb() // this marks the completion of the processing by the worker
              // return false
            }
            Logger.info(`consumerGroup::['${topics}'] Committing index`)
            // cb() // this marks the completion of the processing by the worker
            // return true
          })
        cb() // this marks the completion of the processing by the worker
      }
    }).catch(reason => {
      // Logger.error(`consumerGroup::['${clientId}'] funcProcessMessage(${funcProcessMessage.name}) failed with the following reason: ${reason}`)
      Logger.error(`consumerGroup::[''] funcProcessMessage(${funcProcessMessage.name}) failed with the following reason: ${reason}`)
      cb()
      return reason
    })
  }, 1)

  // a callback function, invoked when queue is empty.
  q.drain = function () {
    consumer.resume()
  }

  consumer.on('error', function onError (error) {
    console.error(error)
    console.error(error.stack)
    // return false
  })

  consumer.on('message', function onMessage (message) {
    console.log('consumerGroup::%s read msg Topic="%s" Partition=%s Offset=%d', this.client.clientId, message.topic, message.partition, message.offset)
    Logger.info(`consumerGroup::['${topics}'] Consumed message: ${JSON.stringify(message)}`)
    q.push(message, function (err, result) {
      if (err) {
        Logger.error(err)
        return err
      }
    })
    consumer.pause() // Pause kafka consumer group to not receive any more new messages
  })
}

const createConsumerGroup = (groupId, funcProcessMessage, topics, options) => {
  // var localOptions = {
  //   // host: 'localhost:2181',  // zookeeper host omit if connecting directly to broker (see kafkaHost below)
  //   kafkaHost: 'localhost:9092', // connect directly to kafka broker (instantiates a KafkaClient)
  //   // zk: undefined,   // put client zk settings if you need them (see Client)
  //   // batch: undefined, // put client batch settings if you need them (see Client)
  //   // ssl: true, // optional (defaults to false) or tls options hash
  //   groupId: groupId,
  //   sessionTimeout: 15000,
  //   // An array of partition assignment protocols ordered by preference.
  //   // 'roundrobin' or 'range' string for built ins (see below to pass in custom assignment protocol)
  //   // protocol: ['roundrobin'],
  //   // Offsets to use for new groups other options could be 'earliest' or 'none' (none will emit an error if no offsets were saved)
  //   // equivalent to Java client's auto.offset.reset
  //   fromOffset: 'earliest', // default
  //   autoCommit: false,
  //   // how to recover from OutOfRangeOffset error (where save offset is past server retention) accepts same value as fromOffset
  //   outOfRangeOffset: 'earliest' // default
  //   // migrateHLC: false,    // for details please see Migration section below
  //   // migrateRolling: true
  // }
  var localOptions = options

  var consumer = new kafkanode.ConsumerGroup(localOptions, topics)

  var q = async.queue(function (message, cb) {
    var payload = JSON.parse(message.value)
    funcProcessMessage(payload).then(result => {
      if (result) {
        // Logger.info('result: %s', result)
        consumer.commit(
          function (err, result) {
            if (err) {
              Logger.info(`consumerGroup::['${topics}'] Committing index error: ${JSON.stringify(err)}`)
              // cb() // this marks the completion of the processing by the worker
              // return false
            }
            Logger.info(`consumerGroup::['${topics}'] Committing index`)
            // cb() // this marks the completion of the processing by the worker
            // return true
          })
        cb() // this marks the completion of the processing by the worker
      }
    }).catch(reason => {
      // Logger.error(`consumerGroup::['${clientId}'] funcProcessMessage(${funcProcessMessage.name}) failed with the following reason: ${reason}`)
      Logger.error(`consumerGroup::[''] funcProcessMessage(${funcProcessMessage.name}) failed with the following reason: ${reason}`)
      cb()
      return reason
    })
  }, 1)

  // a callback function, invoked when queue is empty.
  q.drain = function () {
    consumer.resume()
  }

  consumer.on('error', function onError (error) {
    console.error(error)
    console.error(error.stack)
    // return false
  })

  consumer.on('message', function onMessage (message) {
    console.log('consumerGroup::%s read msg Topic="%s" Partition=%s Offset=%d', this.client.clientId, message.topic, message.partition, message.offset)
    Logger.info(`consumerGroup::['${topics}'] Consumed message: ${JSON.stringify(message)}`)
    q.push(message, function (err, result) {
      if (err) {
        Logger.error(err)
        return err
      }
    })
    consumer.pause() // Pause kafka consumer group to not receive any more new messages
  })
}

const createConsumerGroups = async (funcProcessMessage, topicRegexFilter, options, config) => {
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
      createConsumerGroup(groupId, funcProcessMessage, topic, options)
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
            // var clientId = setClientId(topic)
            var groupId = options.groupId
            Logger.info(`kafkaConsumer:: Poller '${topicRegexFilter}' creating Kafka Consumer with Topic=['${topic}']`)
            createConsumerGroup(groupId, funcProcessMessage, topic, options)
          })
        }
      })
    }, null, true, config.pollingTimeZone)
  }).catch(reason => {
    Logger.error(`kafkaConsumer:: Poller '${topicRegexFilter}' Unable to fetch list topics with regex topicRegexFilter(${topicRegexFilter}) with the following reason: ${reason}`)
  })
}

exports.createConsumerGroups = createConsumerGroups

exports.register = (server, options, next) => {
  const kafkaOptions = Config.TOPICS_KAFKA_CONSUMER_OPTIONS
  const kafkaConfig = Config.TOPICS_KAFKA_CONSUMER_CONFIG

  createConsumerGroups(Commands.prepareExecute, Config.TOPICS_PREPARE_TX_REGEX, kafkaOptions, kafkaConfig)
  createConsumerGroups((msg) => {
    return new Promise((resolve, reject) => {
      Logger.info(`Message process for Notifications ${JSON.stringify(msg)}`)
      return resolve(true)
    })
  }, Config.TOPICS_PREPARE_NOTIFICATION_REGEX, kafkaOptions, kafkaConfig)
  next()
}

exports.register.attributes = {
  name: 'consume.message'
}
