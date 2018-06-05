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
 * Deon Botha <deon.botha@modusbox.com>

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
const TransferState = require('../../domain/transfer/state')
// const CryptoConditions = require('../../crypto-conditions')
const FiveBellsCondition = require('five-bells-condition')
const ilp = require('../../models/ilp')

const TRANSFER = 'transfer'
const PREPARE = 'prepare'
const FULFIL = 'fulfil'
const REJECT = 'reject'
const COMMIT = 'commit'

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
    Logger.info('TransferHandler::prepare')
    const consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TRANSFER, PREPARE))
    const payload = message.value.content.payload
    let {validationPassed, reasons} = await Validator.validateByName(payload)
    if (validationPassed) {
      Logger.info('TransferHandler::prepare::validationPassed')
      const existingTransfer = await TransferQueries.getById(payload.transferId)
      if (!existingTransfer) {
        Logger.info('TransferHandler::prepare::validationPassed::newEntry')
        // const result = await TransferHandler.prepare(payload)
        await TransferHandler.prepare(payload)
        await consumer.commitMessageSync(message)
        // position topic to be created and inserted here
        await Utility.produceParticipantMessage(payload.payerFsp, Utility.ENUMS.POSITION, PREPARE, message.value, Utility.ENUMS.STATE.SUCCESS)
        return true
      } else {
        Logger.info('TransferHandler::prepare::validationFailed::existingEntry')
        await consumer.commitMessageSync(message)
        // notification of duplicate to go here
        await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.FAILURE)
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
        await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      } else {
        Logger.info('TransferHandler::prepare::validationFailed::existingEntry')
        // const {alreadyRejected, transfer} = await TransferHandler.reject(reasons.toString(), existingTransfer.transferId)
        await TransferHandler.reject(reasons.toString(), existingTransfer.transferId)
        await consumer.commitMessageSync(message)
        await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      }
    }
  } catch (error) {
    Logger.error(error)
    throw error
  }
}

const fulfil = async (error, messages) => {
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
    Logger.info('FulfilHandler::fulfil')
    const consumer = Kafka.Consumer.getConsumer(Utility.transformGeneralTopicName(TRANSFER, FULFIL))
    const metadata = message.value.metadata
    const transferId = message.value.id
    const payload = message.value.content.payload
    if (metadata.event.type === FULFIL && metadata.event.action === COMMIT) {
      const existingTransfer = await TransferQueries.getById(transferId)
      const fulfilmentCondition = FiveBellsCondition.fulfillmentToCondition(payload.fulfilment)
      if (!existingTransfer) {
        Logger.info('FulfilHandler::fulfil::validationFailed::notFound')
        await consumer.commitMessageSync(message)
        await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      // } else if (CryptoConditions.validateFulfillment(payload.fulfilment, existingTransfer.condition)) { // TODO: when implemented
      } else if (fulfilmentCondition !== existingTransfer.condition) { // TODO: FiveBellsCondition.fulfillmentToCondition always passes
        Logger.info('FulfilHandler::fulfil::validationFailed::invalidFulfilment')
        await consumer.commitMessageSync(message)
        await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      } else if (existingTransfer.transferState !== TransferState.RESERVED) {
        Logger.info('FulfilHandler::fulfil::validationFailed::existingEntry')
        await consumer.commitMessageSync(message)
        await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      } else { // validations success
        Logger.info('FulfilHandler::fulfil::validationPassed')
        await ilp.update({ilpId: existingTransfer.ilpId, fulfilment: payload.fulfilment})
        await consumer.commitMessageSync(message)
        await Utility.produceParticipantMessage(existingTransfer.payeeFsp, Utility.ENUMS.POSITION, PREPARE, message.value, Utility.ENUMS.STATE.SUCCESS)
        return true
      }
    } else if (metadata.event.type === FULFIL && metadata.event.action === REJECT) {
      throw new Error('Not implemented')
      // TODO: fulfil reject flow {2.2.1.} to be implemented here
    } else {
      Logger.info('FulfilHandler::fulfil::invalidEventAction')
      await consumer.commitMessageSync(message)
      await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.FAILURE)
      return true
    }
  } catch (error) {
    Logger.error(error)
    throw error
  }
}

const reject = async () => {
  // TODO: delete method and use fulfil reject condition (see line 177)
  throw new Error('Not implemented')
}
/**
 * @method transfer
 *
 * @async
 * This is the consumer callback function that gets registered to a topic. This then gets a list of message(s),
 * we will only ever use the first message in non batch processing. We then break down the message into its payload and
 * begin validating the payload. Once the payload is validated successfully it will be written to the database to
 * the relevant tables. If the validation fails it is still written to the database for auditing purposes but with an
 * ABORT status
 *
 * @param {error} error - error thrown if something fails within Kafka
 * @param {array} messages - a list of messages to consume for the relevant topic
 *
 * @returns {object} - Returns a boolean: true if successful, or throws and error if failed
 */
const transfer = async (error, messages) => {
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
    Logger.info('TransferHandler::transfer')
    const consumer = Kafka.Consumer.getConsumer(Utility.transformGeneralTopicName(TRANSFER, TRANSFER))
    await consumer.commitMessageSync(message)
    await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.SUCCESS)
    return true
  } catch (error) {
    Logger.error(error)
    throw error
  }
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
    prepareHandler.config.rdkafkaConf['client.id'] = prepareHandler.topicName
    await Kafka.Consumer.createHandler(prepareHandler.topicName, prepareHandler.config, prepareHandler.command)
    return true
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

/**
 * @method RegisterTransferHandler
 *
 * @async
 * Registers the prepare handlers for all participants. Retrieves the list of all participants from the database and loops through each
 * @function createTransferHandler called to create the handler for each participant
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerTransferHandler = async () => {
  try {
    const transferHandler = {
      command: transfer,
      topicName: Utility.transformGeneralTopicName(TRANSFER, TRANSFER),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TRANSFER.toUpperCase(), TRANSFER.toUpperCase())
    }
    transferHandler.config.rdkafkaConf['client.id'] = transferHandler.topicName
    await Kafka.Consumer.createHandler(transferHandler.topicName, transferHandler.config, transferHandler.command)
    return true
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

/**
 * @method RegisterFulfillHandler
 *
 * @async
 * Registers the one handler for fulfil transfer. Gets Kafka config from default.json
 * @function Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerFulfillHandler = async () => {
  try {
    const fulfillHandler = {
      command: fulfil,
      topicName: Utility.transformGeneralTopicName(TRANSFER, FULFIL),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TRANSFER.toUpperCase(), FULFIL.toUpperCase())
    }
    fulfillHandler.config.rdkafkaConf['client.id'] = fulfillHandler.topicName
    await Kafka.Consumer.createHandler(fulfillHandler.topicName, fulfillHandler.config, fulfillHandler.command)
    return true
  } catch (e) {
    Logger.error(e)
    throw e
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
    rejectHandler.config.rdkafkaConf['client.id'] = rejectHandler.topicName
    await Kafka.Consumer.createHandler(rejectHandler.topicName, rejectHandler.config, rejectHandler.command)
    return true
  } catch (e) {
    Logger.error(e)
    throw e
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
 * Registers all handlers in transfers ie: prepare, fulfil, transfer and reject
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    await registerPrepareHandlers()
    await registerFulfillHandler()
    await registerRejectHandler()
    await registerTransferHandler()
    return true
  } catch (e) {
    throw e
  }
}

module.exports = {
  registerTransferHandler,
  registerPrepareHandlers,
  registerFulfillHandler,
  registerRejectHandler,
  registerAllHandlers,
  prepare,
  fulfil,
  reject,
  transfer
}
