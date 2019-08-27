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

const Consumer = require('@mojaloop/central-services-stream').Kafka.Consumer
const Logger = require('@mojaloop/central-services-shared').Logger
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const listOfConsumers = {}

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
  Logger.info(`CreateHandle::connect - creating Consumer for topics: [${topicName}]`)

  let topicNameArray
  if (Array.isArray(topicName)) {
    topicNameArray = topicName
  } else {
    topicNameArray = [topicName]
  }

  const consumer = new Consumer(topicNameArray, config)

  let autoCommitEnabled = true
  if (config.rdkafkaConf !== undefined && config.rdkafkaConf['enable.auto.commit'] !== undefined) {
    autoCommitEnabled = config.rdkafkaConf['enable.auto.commit']
  }

  let connectedTimeStamp = 0
  try {
    await consumer.connect()
    Logger.info(`CreateHandle::connect - successfuly connected to topics: [${topicNameArray}]`)
    connectedTimeStamp = (new Date()).valueOf()
    await consumer.consume(command)
  } catch (e) {
    // Don't throw the error, still keep track of the topic we tried to connect to
    Logger.warn(`CreateHandle::connect - error: ${e}`)
  }

  topicNameArray.forEach(topicName => {
    listOfConsumers[topicName] = {
      consumer,
      autoCommitEnabled,
      connectedTimeStamp
    }
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
    throw ErrorHandler.Factory.createInternalServerFSPIOPError(`No consumer found for topic ${topicName}`)
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
    throw ErrorHandler.Factory.createInternalServerFSPIOPError(`No consumer found for topic ${topicName}`)
  }
}

/**
 * @function getListOfTopics
 *
 *
 * @description Get a list of topics that the consumer has subscribed to
 *
 * @returns {Array<string>} - list of topics
 */
const getListOfTopics = () => {
  return Object.keys(listOfConsumers)
}

const getMetadataPromise = (consumer, topic) => {
  return new Promise((resolve, reject) => {
    const cb = (err, metadata) => {
      if (err) {
        return reject(new Error(`Error connecting to consumer: ${err.message}`))
      }

      return resolve(metadata)
    }

    consumer.getMetadata({ topic, timeout: 6000 }, cb)
  })
}

/**
 * @function isConnected
 *
 * @param {string} topicName - the topic name of the consumer to check
 *
 * @description Use this to determine whether or not we are connected to the broker. Internally, it calls 'getMetadata' to determine
 * if the broker client is connected.
 *
 * @returns {true} - if connected
 * @throws {Error} - if consumer can't be found or the consumer is not connected
 */
const isConnected = async topicName => {
  const consumer = getConsumer(topicName)

  const metadata = await getMetadataPromise(consumer, topicName)
  const foundTopics = metadata.topics.map(topic => topic.name)
  if (foundTopics.indexOf(topicName) === -1) {
    Logger.debug(`Connected to consumer, but ${topicName} not found.`)
    throw new Error(`Connected to consumer, but ${topicName} not found.`)
  }

  return true
}

module.exports = {
  createHandler,
  getConsumer,
  getListOfTopics,
  isConsumerAutoCommitEnabled,
  isConnected
}
