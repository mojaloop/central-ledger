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

/**
 * @module src/handlers/lib/kafka
 */

// const Consumer = require('@mojaloop/central-services-stream').Kafka.Consumer
// const KafkaEnums = require('@mojaloop/central-services-stream').ENUMS
const KafkaPoc = require('@mojaloop/central-services-stream').Poc
const Logger = require('@mojaloop/central-services-shared').Logger
const uuid = require('uuid4')

let listOfConsumers = {}

/**
 * @function CreateHandler
 *
 * @param {string} topicName - the topic name to be registered for the required handler. Example: 'topic-dfsp1-transfer-prepare'
 * @param {object} config - the config for the consumer for the specific functionality and action, retrieved from the default.json. Example: found in default.json 'KAFKA.CONSUMER.TRANSFER.PREPARE'
 * @param {function} command - the callback handler for the topic. Will be called when the topic is produced against. Example: Command.prepareHandler()
 *
 * @description Parses the accountUri into a participant name from the uri string
 *
 * @returns {object} - Returns a Promise
 * @throws {Error} -  if failure occurs
 */
const createHandler = async (topicName, config, command) => {
  Logger.info(`createHandler::createHandler(${topicName}, ${config}, ${command.name})`)
  try {
    let consumer = {}
    // let topicList = []

    if (config.rdkafkaConf['client.id'] !== undefined) {
      config.rdkafkaConf['client.id'] = `${config.rdkafkaConf['client.id']}-${uuid()}`
    } else {
      config.rdkafkaConf['client.id'] = `default-client-id-${uuid()}`
    }

    consumer = KafkaPoc.createConsumer(topicName, config, command)
    // switch (config.options.mode) {
    //   case KafkaEnums.pocConsumer:
    //     Logger.info(`consumer['${topicName}'] - creating Kafka PoC Consumer`)
    //     consumer = new KafkaPoc.Consumer(topicList, config, command)
    //     consumer.connect()
    //     consumer.on('ready', () => {
    //       Logger.info(`consumer['${topicName}'] - connected`)
    //     })
    //     break
    //   case KafkaEnums.pocStream:
    //     Logger.info(`consumer['${topicName}'] - creating Kafka PoC Stream Consumer`)
    //     consumer = new KafkaPoc.StreamConsumer(topicList, config, command)
    //     Logger.info(`consumer['${topicName}'] - connected`)
    //     break
    //   case KafkaEnums.pocNode:
    //     Logger.info(`consumer['${topicName}'] - creating Kafka PoC Node Consumer`)
    //     consumer = new KafkaPoc.Node(topicList, config, command)
    //     break
    //   default:
    //     Logger.info(`consumer['${topicName}'] - creating Kafka PoC Stream Consumer - DEFAULT`)
    //     consumer = new KafkaPoc.StreamConsumer(topicList, config, command)
    //     Logger.info(`consumer['${topicName}'] - connected`)
    // }

    let autoCommitEnabled = true
    if (Array.isArray(topicName)) {
      for (let topic of topicName) { // NOT OK
        listOfConsumers[topic] = {
          consumer: consumer,
          autoCommitEnabled: autoCommitEnabled
        }
      }
    } else {
      listOfConsumers[topicName] = {
        consumer: consumer,
        autoCommitEnabled: autoCommitEnabled
      }
    }
    // Logger.info(`listOfConsumers: ${JSON.stringify(listOfConsumers.keys())}`)
    Logger.debug(`consumer['${topicName}'] - List of Consumers:`)
    for (var key in listOfConsumers) {
      Logger.debug(`consumer['${topicName}'] - listOfConsumers[${key}]`)
    }
    //
    // // consumer.connect()
    // consumer.on('ready', () => {
    //   Logger.info(`consumer['${topicName}'] - connected`)
    //   let autoCommitEnabled = true
    //   if (Array.isArray(topicName)) {
    //     for (let topic of topicName) { // NOT OK
    //       listOfConsumers[topic] = {
    //         consumer: consumer,
    //         autoCommitEnabled: autoCommitEnabled
    //       }
    //     }
    //   } else {
    //     listOfConsumers[topicName] = {
    //       consumer: consumer,
    //       autoCommitEnabled: autoCommitEnabled
    //     }
    //   }
    //   // Logger.info(`listOfConsumers: ${JSON.stringify(listOfConsumers.keys())}`)
    //   Logger.debug(`consumer['${topicName}'] - List of Consumers:`)
    //   for (var key in listOfConsumers) {
    //     Logger.debug(`consumer['${topicName}'] - listOfConsumers[${key}]`)
    //   }
    // })

    // process.on('SIGINT', () => {
    //   for (var key in listOfConsumers) {
    //     Logger.info(`Disconnecting listOfConsumers[${key}]`)
    //     listOfConsumers[key].consumer.disconnect(() => {
    //       Logger.info(`Disconnected listOfConsumers[${key}]`)
    //     })
    //   }
    // })
  } catch (err) {
    Logger.error(err)
  }
}
// const createHandler = async (topicName, config, command) => {
//   Logger.info(`createHandler::createHandler(${topicName}, ${config}, ${command.name})`)
//   try {
//     let consumer = {}
//
//     if (config.rdkafkaConf['client.id'] !== undefined) {
//       config.rdkafkaConf['client.id'] = `${config.rdkafkaConf['client.id']}-${uuid()}`
//     } else {
//       config.rdkafkaConf['client.id'] = `default-client-id-${uuid()}`
//     }
//
//     if (Array.isArray(topicName)) {
//       consumer = new Stream.Consumer(topicName, config, command)
//     } else {
//       consumer = new Stream.Consumer([topicName], config, command)
//     }
//
//     consumer.connect()
//     consumer.on('ready', () => {
//       Logger.info(`consumer['${topicName}'] - connected`)
//       let autoCommitEnabled = true
//       if (Array.isArray(topicName)) {
//         for (let topic of topicName) { // NOT OK
//           listOfConsumers[topic] = {
//             consumer: consumer,
//             autoCommitEnabled: autoCommitEnabled
//           }
//         }
//       } else {
//         listOfConsumers[topicName] = {
//           consumer: consumer,
//           autoCommitEnabled: autoCommitEnabled
//         }
//       }
//       // Logger.info(`listOfConsumers: ${JSON.stringify(listOfConsumers.keys())}`)
//       Logger.debug(`consumer['${topicName}'] - List of Consumers:`)
//       for (var key in listOfConsumers) {
//         Logger.debug(`consumer['${topicName}'] - listOfConsumers[${key}]`)
//       }
//     })
//
//     // process.on('SIGINT', () => {
//     //   for (var key in listOfConsumers) {
//     //     Logger.info(`Disconnecting listOfConsumers[${key}]`)
//     //     listOfConsumers[key].consumer.disconnect(() => {
//     //       Logger.info(`Disconnected listOfConsumers[${key}]`)
//     //     })
//     //   }
//     // })
//   } catch (err) {
//     Logger.error(err)
//   }
// }
// const createHandler = async (topicName, config, command) => {
//   let consumer = {}
//
//   if (config.rdkafkaConf['client.id'] !== undefined) {
//     config.rdkafkaConf['client.id'] = `${config.rdkafkaConf['client.id']}-${uuid()}`
//   } else {
//     config.rdkafkaConf['client.id'] = `default-client-id-${uuid()}`
//   }
//
//   if (Array.isArray(topicName)) {
//     consumer = new Consumer(topicName, config)
//   } else {
//     consumer = new Consumer([topicName], config)
//   }
//
//   let autoCommitEnabled = true
//   if (config.rdkafkaConf !== undefined && config.rdkafkaConf['enable.auto.commit'] !== undefined) {
//     autoCommitEnabled = config.rdkafkaConf['enable.auto.commit']
//   }
//
//   await consumer.connect().then(async () => {
//     Logger.info(`CreateHandle::connect successful topic: ${topicName}`)
//     await consumer.consume(command)
//     if (Array.isArray(topicName)) {
//       for (let topic of topicName) { // NOT OK
//         listOfConsumers[topic] = {
//           consumer: consumer,
//           autoCommitEnabled: autoCommitEnabled
//         }
//       }
//     } else {
//       listOfConsumers[topicName] = {
//         consumer: consumer,
//         autoCommitEnabled: autoCommitEnabled
//       }
//     }
//   }).catch((e) => {
//     Logger.error(e)
//     Logger.info('Consumer error has occurred')
//     throw e
//   })
// }

/**
 * @function GetConsumer
 *
 * @param {string} topicName - the topic name to locate a specific consumer
 *
 * @description This is used to get a consumer with the topic name to commit the messages that have been received
 *
 * @returns {Consumer} - Returns consumer
 * @throws {Error} - if consumer not found for topic name
 */
const getConsumer = (topicName) => {
  if (listOfConsumers[topicName]) {
    return listOfConsumers[topicName].consumer
  } else {
    throw Error(`No consumer found for topic ${topicName}`)
  }
}

/**
 * @function isConsumerAutoCommitEnabled
 *
 * @param {string} topicName - the topic name to locate a specific consumer
 *
 * @description This is used to get a consumer with the topic name to commit the messages that have been received
 *
 * @returns {Consumer} - Returns consumer
 * @throws {Error} - if consumer not found for topic name
 */
const isConsumerAutoCommitEnabled = (topicName) => {
  if (listOfConsumers[topicName]) {
    return listOfConsumers[topicName].autoCommitEnabled
  } else {
    throw Error(`No consumer found for topic ${topicName}`)
  }
}

module.exports = {
  createHandler,
  getConsumer,
  isConsumerAutoCommitEnabled
}
