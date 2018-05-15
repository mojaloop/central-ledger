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
const TransferHandler = require('../../domain/transfer')
const Utility = require('../lib/utility')
const DAO = require('../lib/dao')
const Kafka = require('../lib/kafka')
const Validator = require('./validator')
const TransferQueries = require('../../domain/transfer/queries')
const Notifications = require('../notification/handler')

const TRANSFER = 'transfer'
const PREPARE = 'prepare'
const FULFILL = 'fulfill'
const REJECT = 'reject'

/**
 * @method producerNotificationMessage
 *
 * @async
 * This is an async method that produces a message against the Kafka notification topic. it is called multiple times
 *
 * @param {object} message - a list of messages to consume for the relevant topic
 * @param {object} state - state of the message being produced
 *
 * @function Kafka.Producer.produceMessage to persist the message to the configured topic on Kafka
 * @function Utility.updateMessageProtocolMetadata updates the messages metadata
 * @function Utility.createGeneralTopicConf dynamically gets the topic configuration
 * @function Utility.getKafkaConfig dynamically gets Kafka configuration
 *
 * @returns {object} - Returns a boolean: true if successful, or throws and error if failed
 */
const producerNotificationMessage = async (message, state) => {
  await Kafka.Producer.produceMessage(Utility.updateMessageProtocolMetadata(message, Utility.ENUMS.NOTIFICATION, state),
    Utility.createGeneralTopicConf(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT),
    Utility.getKafkaConfig(Utility.ENUMS.PRODUCER, Utility.ENUMS.NOTIFICATION.toUpperCase(), Utility.ENUMS.EVENT.toUpperCase()))
}

/**
 * @method prepare
 *
 * @async
 * This is the consumer callback function that gets registered to a topic. This then gets a list of message,
 * we will only ever use the first message in non batch processing. We then break down the message into its payload and
 * begin validating the payload. Once the payload is validated successfully it will be written to the database to
 * the relevant tables. If the validation fails it is still written to the database for auditing purposes but with an
 * ABORT status
 *
 * @param {error} error - error thrown if something fails within Kafka
 * @param {array} messages - a list of messages to consume for the relevant topic
 *
 * @function Validator.validateByName to validate the payload of the message
 * @function TransferQueries.getById checks if the transfer currently exists
 * @function TransferHandler.prepare creates new entries in transfer tables for successful prepare transfer
 * @function TransferHandler.reject rejects an existing transfer that has been retried and fails validation
 *
 * @returns {object} - Returns a boolean: true if successful, or throws and error if failed
 */
const prepare = async (error, messages) => {
  if (error) {
    Logger.error(error)
  }
  let message = {}
  try {
    if (Array.isArray(messages)) {
      message = messages[0]
    } else {
      message = messages
    }
    Logger.info('TransferHandler::prepare')
    const consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TRANSFER, PREPARE))
    const payload = message.value.content.payload
    let {validationPassed, reasons} = await Validator.validateByName(payload)
    if (validationPassed) {
      Logger.info('TransferHandler::prepare::validationPassed')
      const existingTransfer = await TransferQueries.getById(payload.transferId)
      if (!existingTransfer) {
        Logger.info('TransferHandler::prepare::validationPassed::newEntry')
        const result = await TransferHandler.prepare(payload)
        await consumer.commitMessageSync(message)
        // position topic to be created and inserted here
        return true
      } else {
        Logger.info('TransferHandler::prepare::validationFailed::existingEntry')
        await consumer.commitMessageSync(message)
        // notification of duplicate to go here
        await producerNotificationMessage(message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      }
    } else {
      Logger.info('TransferHandler::prepare::validationFailed')
      // need to determine what happens with existing transfer with a validation failure
      const existingTransfer = await TransferQueries.getById(payload.transferId)
      if (!existingTransfer) {
        Logger.info('TransferHandler::prepare::validationFailed::newEntry')
        await TransferHandler.prepare(payload, reasons.toString(), false)
        // notification of prepare transfer to go here
        await consumer.commitMessageSync(message)
        await producerNotificationMessage(message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      } else {
        Logger.info('TransferHandler::prepare::validationFailed::existingEntry')
        const {alreadyRejected, transfer} = await TransferHandler.reject(reasons.toString(), existingTransfer.transferId)
        await consumer.commitMessageSync(message)
        await producerNotificationMessage(message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      }
    }
  } catch (error) {
    Logger.error(error)
  }
}

const fulfill = async () => {

}

const reject = async () => {

}

/**
 * @method CreatePrepareHandler
 *
 * @async
 * Registers the handler for each participant topic created. Gets Kafka config from default.json
 *
 * @function Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const createPrepareHandler = async (participantName) => {
  try {
    const prepareHandler = {
      command: prepare,
      topicName: Utility.transformAccountToTopicName(participantName, TRANSFER, PREPARE),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TRANSFER.toUpperCase(), PREPARE.toUpperCase())
    }
    await Kafka.Consumer.createHandler(prepareHandler.topicName, prepareHandler.config, prepareHandler.command)
  } catch (e) {
    Logger.error(e)
  }
}

const createTransferHandler = async (participantName) => {
  try {
    const transferHandler = {
      command: prepare,
      topicName: Utility.transformAccountToTopicName(participantName, TRANSFER, TRANSFER),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TRANSFER.toUpperCase(), PREPARE.toUpperCase())
    }
    await Kafka.Consumer.createHandler(transferHandler.topicName, transferHandler.config, transferHandler.command)
  } catch (e) {
    throw e
  }
}

/**
 * @method RegisterFulfillHandler
 *
 * @async
 * Registers the one handler for fulfill transfer. Gets Kafka config from default.json
 * @function Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerFulfillHandler = async () => {
  try {
    const fulfillHandler = {
      command: fulfill,
      topicName: Utility.transformGeneralTopicName(TRANSFER, FULFILL),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TRANSFER.toUpperCase(), FULFILL.toUpperCase())
    }
    await Kafka.Consumer.createHandler(fulfillHandler.topicName, fulfillHandler.config, fulfillHandler.command)
    return true
  } catch (e) {
    Logger.error(e)
  }
}

/**
 * @method RegisterRejectHandler
 *
 * @async
 * Registers the one handler for reject transfer. Gets Kafka config from default.json
 * @function Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerRejectHandler = async () => {
  try {
    const rejectHandler = {
      command: reject,
      topicName: Utility.transformGeneralTopicName(TRANSFER, REJECT),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TRANSFER.toUpperCase(), REJECT.toUpperCase())
    }
    await Kafka.Consumer.createHandler(rejectHandler.topicName, rejectHandler.config, rejectHandler.command)
    return true
  } catch (e) {
    Logger.error(e)
  }
}

/**
 * @method RegisterPrepareHandlers
 *
 * @async
 * Registers the prepare handlers for all participants. Retrieves the list of all participants from the database and loops through each
 * @function createPrepareHandler called to create the handler for each participant
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerPrepareHandlers = async () => {
  try {
    const participantNames = await DAO.retrieveAllParticipants()
    for (let name of participantNames) {
      await createPrepareHandler(name)
    }
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
 * Registers all handlers in transfers ie: prepare, fulfill and reject
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    await registerPrepareHandlers()
    await Notifications.registerNotificationHandler()
    //await registerFulfillHandler()
    //await registerRejectHandler()
    return true
  } catch (e) {
    throw e
  }
}

module.exports = {
  registerPrepareHandlers,
  registerFulfillHandler,
  registerRejectHandler,
  registerAllHandlers
}
