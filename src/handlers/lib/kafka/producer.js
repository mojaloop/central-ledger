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

 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @module src/handlers/lib/kafka
 */

const Producer = require('@mojaloop/central-services-shared').Kafka.Producer
const Logger = require('@mojaloop/central-services-shared').Logger

let p

/**
 * @function ProduceMessage
 *
 * @param {string} messageProtocol - message being created against topic
 * @param {object} topicConf - configuration for the topic to produce to
 * @param {object} config - Producer configuration, eg: to produce batch or poll
 *
 * @description Creates a producer on Kafka for the specified topic and configuration
 *
 * @returns {boolean} - returns true if producer successfully created and producers to
 * @throws {error} - if not successfully create/produced to
 */
const produceMessage = async (messageProtocol, topicConf, config) => {
  try {
    Logger.info('Producer::start::topic=' + topicConf.topicName)
    p = new Producer(config)
    Logger.info('Producer::connect::start')
    await p.connect()
    Logger.info('Producer::connect::end')
    Logger.info(`Producer.sendMessage:: messageProtocol:'${JSON.stringify(messageProtocol)}'`)
    await p.sendMessage(messageProtocol, topicConf)
    Logger.info('Producer::end')
    return true
  } catch (e) {
    Logger.error(e)
    Logger.info('Producer error has occurred')
    throw e
  }
}

/**
 * @function Disconnect
 *
 * @description Disconnects the current producer from Kafka
 *
 * @returns {object} Promise
 */
const disconnect = async () => {
  try {
    await p.disconnect()
  } catch (e) {
    throw e
  }
}

module.exports = {
  produceMessage,
  disconnect
}
