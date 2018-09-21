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

const Consumer = require('@mojaloop/central-services-shared').Kafka.Consumer
const Logger = require('@mojaloop/central-services-shared').Logger

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
  let consumer = {}
  if (Array.isArray(topicName)) {
    consumer = new Consumer(topicName, config)
  } else {
    consumer = new Consumer([topicName], config)
  }

  let autoCommitEnabled = true
  if (config.rdkafkaConf !== undefined && config.rdkafkaConf['enable.auto.commit'] !== undefined) {
    autoCommitEnabled = config.rdkafkaConf['enable.auto.commit']
  }

  await consumer.connect().then(async () => {
    Logger.info(`CreateHandle::connect successful topic: ${topicName}`)
    await consumer.consume(command)
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
  }).catch((e) => {
    Logger.error(e)
    Logger.info('Consumer error has occurred')
    throw e
  })
}

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
    return undefined
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
    throw Error(`no consumer found for topic ${topicName}`)
  }
}

module.exports = {
  createHandler,
  getConsumer,
  isConsumerAutoCommitEnabled
}
