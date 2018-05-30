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
const Logger = require('@mojaloop/central-services-shared').Logger
const Utility = require('../lib/utility')
const Kafka = require('../lib/kafka')

const NOTIFICATION = 'notification'
const EVENT = 'event'

const mockNotification = async (error, messages) => {
  if (error) {
    // Logger.error(error)
    throw new Error()
  }
  let message = {}
  try {
    if (Array.isArray(messages)) {
      message = messages[0]
    } else {
      message = messages
    }
    Logger.info('NotificationHandler::notification')
    const consumer = Kafka.Consumer.getConsumer(Utility.transformGeneralTopicName(NOTIFICATION, EVENT))
    await consumer.commitMessageSync(message)
    return true
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

/**
 * @method RegisterNotificationHandler
 *
 * @async
 * Registers the one handler for notifications. Gets Kafka config from default.json
 * @function Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerNotificationHandler = async () => {
  try {
    const notificationHandler = {
      command: mockNotification, // to be changed once notifications are added
      topicName: Utility.transformGeneralTopicName(NOTIFICATION, EVENT),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, NOTIFICATION.toUpperCase(), EVENT.toUpperCase())
    }
    await Kafka.Consumer.createHandler(notificationHandler.topicName, notificationHandler.config, notificationHandler.command)
    return true
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

/**
 * @method RegisterAllHandlers
 *
 * @async
 * Registers all handlers in notifications
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    await registerNotificationHandler()
    return true
  } catch (e) {
    throw e
  }
}

module.exports = {
  registerNotificationHandler,
  registerAllHandlers,
  mockNotification
}
