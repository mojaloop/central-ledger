
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

const kafkaConsumer = (clientId, funcProcessMessage, topicRegexFilter, options) => {
  Logger.info(`kafkaConsumer:: Creating Kafka Consumer clientId:'${clientId}', funcProcessMessage:'${funcProcessMessage.name || 'anonymousFunc'}', topicRegexFilter:'${topicRegexFilter}'`)

  kafka.getListOfFilteredTopics(topicRegexFilter).then(listOfPreparedTopics => {
    var templistOfPreparedTopics = listOfPreparedTopics
    // Logger.info(`List of Topics for for Prepare= ${listOfPreparedTopics}`)

    var topicList = templistOfPreparedTopics.map(topic => {
      return {
        topic: topic,
        partition: 0
      }
    })

    const client = new Client(Config.TOPICS_KAFKA_HOSTS, 'clientId')

    Logger.info(`kafkaConsumer:: Client ${clientId} ready for Consumption for ${JSON.stringify(topicList)}`)

    var consumer = new Consumer(
      client,
      topicList,
      options
    )

    const reLoadConsumersJob = new CronJob('*/10 * * * * *', function () {
      Logger.info(`kafkaConsumer:: Polling for new topic changes for Consumer: '${clientId}'`)
      kafka.getListOfFilteredTopics(topicRegexFilter).then(refreshedListOfPreparedTopics => {
        Logger.info(`kafkaConsumer:: Client ${clientId} ready for Consumption for ${JSON.stringify(refreshedListOfPreparedTopics)}`)
        var difference = refreshedListOfPreparedTopics.filter(x => !templistOfPreparedTopics.includes(x))
        Logger.info(`kafkaConsumer:: Client ${clientId} adding new Topics for Consumption for ${JSON.stringify(difference)}`)
        templistOfPreparedTopics = refreshedListOfPreparedTopics
        if (difference && difference.length) {
          topicList = difference.map(topic => {
            return {
              topic: topic,
              partition: 0
            }
          })
          consumer.addTopics(
            topicList
            , (err, result) => {
              if (err) {
                Logger.error(err)
              }
              Logger.info(`kafkaConsumer:: added new Topic result - ${result}`)
            }, false)
          // client.refreshMetadata(
          //   difference
          //   , (err, result) => {
          //     if (err) {
          //       Logger.error(err)
          //     }
          //     Logger.info(`kafkaConsumer:: refreshMetadata result - ${result}`)
          //   })
          // consumer.pauseTopics(topicList)
          // consumer.resumeTopics(topicList)
        }
        // consumer.resumeTopics(topicList)
      })
    }, null, true, 'America/Los_Angeles')

    var q = async.queue(function (message, cb) {
      var payload = JSON.parse(message.value)
      funcProcessMessage(payload).then(result => {
        if (result) {
          // Logger.info('result: %s', result)
          consumer.commit(
            function (err, result) {
              if (err) {
                Logger.info('kafkaConsumer:: Committing index error: %s', (JSON.stringify(err) || JSON.stringify(result)))
              }
              Logger.info('kafkaConsumer:: Committing index for %s', message.topic)
            })
          cb() // this marks the completion of the processing by the worker
        }
      }).catch(reason => {
        Logger.error(`kafkaConsumer:: funcProcessMessage(${funcProcessMessage.name}) failed with the following reason: ${reason}`)
      })
    }, 1)

    // a callback function, invoked when queue is empty.
    q.drain = function () {
      consumer.resume() // resume listening new messages from the Kafka consumer group
    }

    // //on receipt of message from kafka, push the message to local queue, which then will be processed by worker
    // function onMessage(message) {
    //   q.push(message, function (err, result) {
    //     if (err) { Logger.error(err); return }
    //   })
    //   consumer.pause(); //Pause kafka consumer group to not receive any more new messages
    // }

    consumer.on('message', (message) => {
      Logger.info(`kafkaConsumer:: Consumed from ${message.topic} consumed: ${JSON.stringify(message)}`)

      // var payload = JSON.parse(message.value)

      q.push(message, function (err, result) {
        if (err) { Logger.error(err); return }
      })
      consumer.pause() // Pause kafka consumer group to not receive any more new messages

      // funcProcessMessage(payload).then(result => {
      //   if (result) {
      //     // Logger.info('result: %s', result)
      //     consumer.commit(
      //       function (err, result) {
      //         if (err) {
      //           Logger.info('kafkaConsumer:: Committing index error: %s', (JSON.stringify(err) || JSON.stringify(result)))
      //         }
      //         Logger.info('kafkaConsumer:: Committing index for %s', message.topic)
      //       })
      //   }
      // }).catch(reason => {
      //   Logger.error(`kafkaConsumer:: funcProcessMessage(${funcProcessMessage.name}) failed with the following reason: ${reason}`)
      // })
    })

    consumer.on('error', function (err) {
      Logger.error('kafkaConsumer:: ERROR: %s', err.toString())
    })
  }).catch(reason => {
    Logger.error(`kafkaConsumer:: Unable to fetch list topics with regex topicRegexFilter(${topicRegexFilter}) with the following reason: ${reason}`)
  }
  )
}

exports.register = (server, options, next) => {
  // reLoadConsumersJob.start()
  const kafkaOptions = Config.TOPICS_KAFKA_CONSUMER_OPTIONS

  kafkaConsumer('PREPARE_TX', Commands.prepareExecute, Config.TOPICS_PREPARE_TX_REGEX, kafkaOptions)
  kafkaConsumer('PREPARE_NOTIFICATIONS', (msg) => {
    return new Promise((resolve, reject) => {
      Logger.info(`Message process for Notifications ${JSON.stringify(msg)}`)
      return resolve(true)
    })
  }, Config.TOPICS_PREPARE_NOTIFICATION_REGEX, kafkaOptions)
  next()
}

exports.register.attributes = {
  name: 'consume.message'
}
