'use strict'

// STUFF TO GO IN HERE FOR RE-USABLE PRODUCER CODE
const Config = require('../../../lib/config')
const Events = require('../../../lib/events')
const kafkanode = require('kafka-node')
const Producer = kafkanode.Producer
const KeyedMessage = kafkanode.KeyedMessage
const Client = kafkanode.Client
const Logger = require('@mojaloop/central-services-shared').Logger

// let client = new Client('localhost:2181')
// let client

// const options = {
//   // Configuration for when to consider a message as acknowledged, default 1
//   requireAcks: -1,
//     // The amount of time in milliseconds to wait for all acks before considered, default 100ms
//   ackTimeoutMs: 100,
//   // Partitioner type (default = 0, random = 1, cyclic = 2, keyed = 3, custom = 4), default 0
//   partitionerType: 2
// }

const publishHandler = (event) => {
  return (eventMessage) => {
    const options = Config.TOPICS_KAFKA_PRODUCER_OPTIONS
    const attributes = Config.TOPICS_KAFKA_PRODUCER_ATTRIBUTES
    const { topic, key, msg } = eventMessage
    Logger.info('publishHandler:: start(%s, %s, %s)', topic, key, msg)
    // var topic = topic
    var partition = 0
    // var attributes = 0
    const client = new Client(Config.TOPICS_KAFKA_HOSTS)
    // if (!client) {
    //   client = new Client('localhost:2181')
    // }
    var producer = new Producer(client, options)

    producer.on('ready', async function () {
      var message = JSON.stringify(msg)
      var keyedMessage = new KeyedMessage(key, message)

      producer.createTopics([topic], true, (err, data) => {
        if (err) {
          Logger.error(`'publishHandler:: Error - ${err}`)
        }
        Logger.info(`'publishHandler:: Created topic - ${data}`)
        producer.send([
          { topic: topic, partitions: partition, messages: [keyedMessage], attributes: attributes }
        ], function (err, result) {
          if (err) {
            Logger.error(`publishHandler:: Publish topic(%s) failed with error: ${err}`)
          } else {
            Logger.info('publishHandler:: Publish topic(%s) successful')
          }
          // process.exit()
        })
      })
      //   producer.send([
      //             { topic: topic, partitions: partition, messages: [keyedMessage], attributes: attributes }
      //   ], function (err, result) {
      //     Logger.info('publishHandler:: Publish topic(%s) result: %s', topic, (JSON.stringify(err) || JSON.stringify(result)))
      //     // process.exit()
      //   })
      // }, 10000)

      // producer.send([
      //           { topic: topic, partitions: partition, messages: [keyedMessage], attributes: attributes }
      // ], function (err, result) {
      //   Logger.info('publishHandler:: Publish topic(%s) result: %s', topic, (JSON.stringify(err) || JSON.stringify(result)))
      //   // process.exit()
      // })
      Logger.info("publishHandler:: Sent something keyedMessage='%s'", JSON.stringify(keyedMessage))
    })

    producer.on('publishHandler:: error', function (err) {
      Logger.error('publishHandler:: error: %s', err)
    })

    // client.close((result, err) => {
    //   Logger.error(' %s', topic, (JSON.stringify(err) || JSON.stringify(result)))
    // })
  }
}

const wireEvents = () => {
  // Logger.info('publish.wireEvents::start')
  Events.onPublishMessage(publishHandler('publish.message'))
}

// for nodejs v8.x upgrade (hapi server v17.xx)
// exports.plugin = {
//     name: 'publishkafka',
//     register: (server, options) => {
//         wireEvents()
//     }
// }

exports.register = (server, options, next) => {
  // Logger.info('publish.exports.register:start')
  wireEvents()
  next()
}

exports.register.attributes = {
  name: 'publish.message'
}
