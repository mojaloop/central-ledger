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

const Consumer = require('@mojaloop/central-services-shared').Kafka.Consumer
const Logger = require('@mojaloop/central-services-shared').Logger

let listOfConsumers = {}

/**
 * @method CreateHandler
 *
 * @param {string} topicName - the topic name to be registered for the required handler. Example: 'topic-dfsp1-transfer-prepare'
 * @param {object} config - the config for the consumer for the specific functionality and action, retrieved from the default.json. Example: found in default.json 'KAFKA.CONSUMER.TRANSFER.PREPARE'
 * @param {function} command - the callback handler for the topic. Will be called when the topic is produced against. Example: Command.prepareHandler()
 *
 * Parses the accountUri into a participant name from the uri string
 *
 * @returns {string} - Returns participant name, throws error if failure occurs
 */
const createHandler = async (topicName, config, command) => {
  const consumer = new Consumer([topicName], config)
  await consumer.connect().then(async () => {
    Logger.info(`CreateHandle::connect successful topic: ${topicName}`)
    await consumer.consume(command)
    listOfConsumers[topicName] = consumer
  }).catch((e) => {
    Logger.error(e)
    throw e
  })
}

const getConsumer = (topicName) => {
  if (listOfConsumers[topicName]) {
    return listOfConsumers[topicName]
  } else {
    throw Error(`no consumer found for topic ${topicName}`)
  }
}

module.exports = {
  createHandler,
  getConsumer
}
