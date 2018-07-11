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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Lazola Lucas <lazola.lucas@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Deon Botha <deon.botha@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @module src/handlers/transfers
 */

const Logger = require('@mojaloop/central-services-shared').Logger
const TransferService = require('../../domain/transfer')
const Utility = require('../lib/utility')
const DAO = require('../lib/dao')
const Kafka = require('../lib/kafka')
const Validator = require('./validator')
const TransferState = require('../../lib/enum').TransferState
const TransferEvent = require('../../lib/enum').transferEvent
// const CryptoConditions = require('../../cryptoConditions')
// const FiveBellsCondition = require('five-bells-condition')
// const Crypto = require('crypto')

// TODO: This errorCode and errorDescription are dummy values until a rules engine is established
const errorCode = 3100
const errorDescription = 'Generic validation error'

/**
 * @function TransferPrepareHandler
 *
 * @async
 * @description This is the consumer callback function that gets registered to a topic. This then gets a list of message,
 * we will only ever use the first message in non batch processing. We then break down the message into its payload and
 * begin validating the payload. Once the payload is validated successfully it will be written to the database to
 * the relevant tables. If the validation fails it is still written to the database for auditing purposes but with an
 * ABORT status
 *
 * Validator.validateByName called to validate the payload of the message
 * TransferService.getById called and checks if the transfer currently exists
 * TransferService.prepare called and creates new entries in transfer tables for successful prepare transfer
 * TransferService.reject called and rejects an existing transfer that has been retried and fails validation
 *
 * @param {error} error - error thrown if something fails within Kafka
 * @param {array} messages - a list of messages to consume for the relevant topic
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
    Logger.info('TransferService::prepare')
    const consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TransferEvent.TRANSFER, TransferEvent.PREPARE))
    const payload = message.value.content.payload
    let {validationPassed, reasons} = await Validator.validateByName(payload)
    if (validationPassed) {
      Logger.info('TransferService::prepare::validationPassed')
      const existingTransfer = await TransferService.getTransferById(payload.transferId)
      if (!existingTransfer) {
        Logger.info('TransferService::prepare::validationPassed::newEntry')
        await TransferService.prepare(payload)
        await consumer.commitMessageSync(message)
        // position topic to be created and inserted here
        await Utility.produceParticipantMessage(payload.payerFsp, Utility.ENUMS.POSITION, TransferEvent.PREPARE, message.value, Utility.ENUMS.STATE.SUCCESS)
        return true
      } else {
        Logger.info('TransferService::prepare::validationFailed::existingEntry')
        await consumer.commitMessageSync(message)
        // notification of duplicate to go here
        message.value.content.payload = Utility.createPrepareErrorStatus(errorCode, errorDescription, message.value.content.payload.extensionList)
        await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.createState(Utility.ENUMS.STATE.FAILURE.status, errorCode, errorDescription))
        return true
      }
    } else {
      Logger.info('TransferService::prepare::validationFailed')
      // need to determine what happens with existing transfer with a validation failure
      const existingTransfer = await TransferService.getById(payload.transferId)
      if (!existingTransfer) {
        Logger.info('TransferService::prepare::validationFailed::newEntry')
        await TransferService.prepare(payload, reasons.toString(), false)
        // notification of prepare transfer to go here
        await consumer.commitMessageSync(message)
        message.value.content.payload = Utility.createPrepareErrorStatus(errorCode, errorDescription, message.value.content.payload.extensionList)
        await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.createState(Utility.ENUMS.STATE.FAILURE.status, errorCode, errorDescription))
        return true
      } else {
        Logger.info('TransferService::prepare::validationFailed::existingEntry')
        // const {alreadyRejected, transfer} = await TransferService.reject(reasons.toString(), existingTransfer.transferId)
        await TransferService.reject(reasons.toString(), existingTransfer.transferId)
        await consumer.commitMessageSync(message)
        message.value.content.payload = Utility.createPrepareErrorStatus(errorCode, errorDescription, message.value.content.payload.extensionList)
        await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.createState(Utility.ENUMS.STATE.FAILURE.status, errorCode, errorDescription))
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
    const consumer = Kafka.Consumer.getConsumer(Utility.transformGeneralTopicName(TransferEvent.TRANSFER, TransferEvent.FULFIL))
    const metadata = message.value.metadata
    const transferId = message.value.id
    const payload = message.value.content.payload
    if (metadata.event.type === TransferEvent.FULFIL && metadata.event.action === TransferEvent.COMMIT) {
      const existingTransfer = await TransferService.getById(transferId)

      // @NOTE: This has been commented out as it does not conform to the Mojaloop Specification. The Crypo-conditions are generic and do not conform to any specific protocol, but rather must be determined by the implemented schema
      // const fulfilmentCondition = FiveBellsCondition.fulfillmentToCondition(payload.fulfilment)

      if (!existingTransfer) {
        Logger.info('FulfilHandler::fulfil::validationFailed::notFound')
        await consumer.commitMessageSync(message)
        await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      } else if (Validator.validateFulfilCondition(payload.fulfilment, existingTransfer.condition)) { // NOTE: re-aligned to the Mojaloop specification
      // } else if (CryptoConditions.validateFulfillment(payload.fulfilment, existingTransfer.condition)) { // TODO: when implemented
      // } else if (fulfilmentCondition !== existingTransfer.condition) { // TODO: FiveBellsCondition.fulfillmentToCondition always passes
        Logger.info('FulfilHandler::fulfil::validationFailed::invalidFulfilment')
        await consumer.commitMessageSync(message)
        await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      } else if (existingTransfer.transferState !== TransferState.RESERVED) {
        Logger.info('FulfilHandler::fulfil::validationFailed::nonReservedState')
        await consumer.commitMessageSync(message)
        await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      } else if (existingTransfer.expirationDate <= new Date()) { // TODO: add to sequence diagram - seq-fulfil-2.1.1.svg
        Logger.info('FulfilHandler::fulfil::validationFailed::transferExpired')
        await consumer.commitMessageSync(message)
        await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      } else { // validations success
        Logger.info('FulfilHandler::fulfil::validationPassed')
        await TransferService.fulfil(transferId, payload)
        await consumer.commitMessageSync(message)
        await Utility.produceParticipantMessage(existingTransfer.payeeFsp, Utility.ENUMS.POSITION, TransferEvent.PREPARE, message.value, Utility.ENUMS.STATE.SUCCESS)
        return true
      }
    } else if (metadata.event.type === TransferEvent.FULFIL && metadata.event.action === TransferEvent.REJECT) {
      throw new Error('Not implemented')
      // TODO: Fulfil reject flow {2.2.1.} to be implemented here
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
  // TODO: Delete method and use fulfil reject condition (see metadata.event.action === TransferEvent.REJECT)
  throw new Error('Not implemented')
}
/**
 * @function TransferTransferService
 *
 * @async
 * @description This is the consumer callback function that gets registered to a topic. This then gets a list of message(s),
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
  Logger.info('TransferService::transfer')
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

    // const {metadata, from, to, content, id} = message.value
    const {metadata} = message.value
    const {action, state} = metadata.event
    const status = state.status
    Logger.info('TransferService::transfer action: ' + action)
    Logger.info('TransferService::transfer status: ' + status)

    // Validate event - Rule: type == 'transfer' && action == 'commit'
    if (action.toLowerCase() === 'prepare' && status.toLowerCase() === 'success') {
      const consumer = Kafka.Consumer.getConsumer(Utility.transformGeneralTopicName(TransferEvent.TRANSFER, TransferEvent.TRANSFER))

      await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.SUCCESS)

      await consumer.commitMessageSync(message)

      return true
    } else if (action.toLowerCase() === 'commit' && status.toLowerCase() === 'success') {
      const consumer = Kafka.Consumer.getConsumer(Utility.transformGeneralTopicName(TransferEvent.TRANSFER, TransferEvent.TRANSFER))

      // send notification message to Payee
      await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.SUCCESS)

      // send notification message to Payer
      // message.value.to = from
      // await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.SUCCESS)

      await consumer.commitMessageSync(message)

      return true
    } else {
      Logger.warning('TransferService::transfer - Unknown event...nothing to do here')
      return true
    }
    // const consumer = Kafka.Consumer.getConsumer(Utility.transformGeneralTopicName(TransferEvent.TRANSFER, TransferEvent.TRANSFER))
    // await consumer.commitMessageSync(message)
    // await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message.value, Utility.ENUMS.STATE.SUCCESS)
    // return true
  } catch (error) {
    Logger.error(error)
    throw error
  }
}

/**
 * @function CreatePrepareHandler
 *
 * @async
 * @description Registers the handler for each participant topic created. Gets Kafka config from default.json
 *
 * Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const createPrepareHandler = async (participantName) => {
  try {
    const prepareHandler = {
      command: prepare,
      topicName: Utility.transformAccountToTopicName(participantName, TransferEvent.TRANSFER, TransferEvent.PREPARE),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TransferEvent.TRANSFER.toUpperCase(), TransferEvent.PREPARE.toUpperCase())
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
 * @function RegisterTransferService
 *
 * @async
 * @description Registers the prepare handlers for all participants. Retrieves the list of all participants from the database and loops through each
 * createTransferService called to create the handler for each participant
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerTransferService = async () => {
  try {
    const transferHandler = {
      command: transfer,
      topicName: Utility.transformGeneralTopicName(TransferEvent.TRANSFER, TransferEvent.TRANSFER),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TransferEvent.TRANSFER.toUpperCase(), TransferEvent.TRANSFER.toUpperCase())
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
 * @function RegisterFulfillHandler
 *
 * @async
 * @description Registers the one handler for fulfil transfer. Gets Kafka config from default.json
 * Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerFulfillHandler = async () => {
  try {
    const fulfillHandler = {
      command: fulfil,
      topicName: Utility.transformGeneralTopicName(TransferEvent.TRANSFER, TransferEvent.FULFIL),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TransferEvent.TRANSFER.toUpperCase(), TransferEvent.FULFIL.toUpperCase())
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
 * @function RegisterRejectHandler
 *
 * @async
 * @description Registers the one handler for reject transfer. Gets Kafka config from default.json
 * Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerRejectHandler = async () => {
  try {
    const rejectHandler = {
      command: reject,
      topicName: Utility.transformGeneralTopicName(TransferEvent.TRANSFER, TransferEvent.REJECT),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TransferEvent.TRANSFER.toUpperCase(), TransferEvent.REJECT.toUpperCase())
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
 * @function RegisterPrepareHandlers
 *
 * @async
 * @description Registers the prepare handlers for all participants. Retrieves the list of all participants from the database and loops through each
 * createPrepareHandler called to create the handler for each participant
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerPrepareHandlers = async () => {
  try {
    const participantNames = await DAO.retrieveAllParticipants()
    if (participantNames.length !== 0) {
      for (let name of participantNames) {
        await createPrepareHandler(name)
      }
    } else {
      Logger.info('No participants for prepare handler creation')
    }
    return true
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

/**
 * @function RegisterAllHandlers
 *
 * @async
 * @description Registers all handlers in transfers ie: prepare, fulfil, transfer and reject
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    await registerPrepareHandlers()
    await registerFulfillHandler()
    await registerRejectHandler()
    await registerTransferService()
    return true
  } catch (e) {
    throw e
  }
}

module.exports = {
  registerTransferService,
  registerPrepareHandlers,
  registerFulfillHandler,
  registerRejectHandler,
  registerAllHandlers,
  prepare,
  fulfil,
  reject,
  transfer
}
