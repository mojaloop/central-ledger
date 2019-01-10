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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>

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
const Enum = require('../../lib/enum')
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction
const TransferObjectTransform = require('../../domain/transfer/transform')
const Errors = require('../../lib/errors')

// TODO: This errorCode and errorDescription are dummy values until a rules engine is established
const errorGenericCode = 3100
const errorGenericDescription = Errors.getErrorDescription(errorGenericCode)
const errorModifiedReqCode = 3106
const errorModifiedReqDescription = Errors.getErrorDescription(errorModifiedReqCode)
const errorInternalCode = 2001
const errorInternalDescription = Errors.getErrorDescription(errorInternalCode)
const errorTransferExpCode = 3303
const errorTransferExpDescription = Errors.getErrorDescription(errorTransferExpCode)

/**
 * @function TransferPrepareHandler
 *
 * @async
 * @description This is the consumer callback function that gets registered to a topic. This then gets a list of messages,
 * we will only ever use the first message in non batch processing. We then break down the message into its payload and
 * begin validating the payload. Once the payload is validated successfully it will be written to the database to
 * the relevant tables. If the validation fails it is still written to the database for auditing purposes but with an
 * INVALID status. For any duplicate requests we will send appropriate callback based on the transfer state and the hash validation
 *
 * TransferService.validateDuplicateHash called to validate/insert the hash of the payload of the message
 * Validator.validateByName called to validate the payload of the message
 * TransferService.getById called to get the details of the existing transfer
 * TransferObjectTransform.toTransfer called to tranform the trnasfer object
 * TransferService.prepare called and creates new entries in transfer tables for successful prepare transfer
 * TransferService.logTransferError called to log the invalid request
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
    let consumer
    Logger.info('TransferService::prepare')
    const kafkaTopic = message.topic
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (e) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(e)
      return true
    }
    const payload = message.value.content.payload

    Logger.info('TransferService::prepare::checking for duplicates')
    const { existsMatching, existsNotMatching } = await TransferService.validateDuplicateHash(payload)

    if (existsMatching) {
      // There is a matching hash
      Logger.info('TransferService::prepare::dupcheck::existsMatching')
      if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
        await consumer.commitMessageSync(message)
      }

      const transferState = await TransferService.getTransferStateChange(payload.transferId)

      if (!transferState || !transferState.enumeration) {
        // Transfer state not found send callback notification
        Logger.info('TransferService::prepare::dupcheck::existsMatching::transfer state not found send callback notification')
        message.value.content.payload = Utility.createPrepareErrorStatus(errorGenericCode, errorGenericDescription, message.value.content.payload.extensionList)
        await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE, message.value, Utility.createState(Utility.ENUMS.STATE.FAILURE.status, errorGenericCode, errorGenericDescription))
        return true
      }
      const transferStateEnum = transferState.enumeration

      if (transferStateEnum === TransferState.COMMITTED || transferStateEnum === TransferState.ABORTED) {
        // The request is already finalized
        Logger.info('TransferService::prepare::dupcheck::existsMatching::The request is already finalized, send the callback with status of the request')
        let record = await TransferService.getById(payload.transferId)
        message.value.content.payload = TransferObjectTransform.toTransfer(record)
        await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE_DUPLICATE, message.value, Utility.ENUMS.STATE.SUCCESS)
        return true

        // TODO: This state of RECEIVED is no longer available in the Seeds. Need to understand if this should be another state or perhaps even removed?
      } else if (transferStateEnum === TransferState.RECEIVED || transferStateEnum === TransferState.RESERVED) {
        // The request is in progress, do nothing
        Logger.info('TransferService::prepare::dupcheck::existsMatching:: previous request is still in progress do nothing')
        return true
      }
    }
    if (existsNotMatching) { // The request already exists with different params, so send error notification
      Logger.info('TransferService::prepare::dupcheck::existsNotMatching:: request exists with different parameters')
      if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
        await consumer.commitMessageSync(message)
      }
      Logger.info('TransferService::prepare::dupcheck::existsNotMatching:: send callback notification')
      message.value.content.payload = Utility.createPrepareErrorStatus(errorModifiedReqCode, errorModifiedReqDescription, message.value.content.payload.extensionList)
      await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE, message.value, Utility.createState(Utility.ENUMS.STATE.FAILURE.status, errorModifiedReqCode, errorModifiedReqDescription))
      return true
    }

    let { validationPassed, reasons } = await Validator.validateByName(payload)
    if (validationPassed) {
      Logger.info('TransferService::prepare::validationPassed')
      try {
        Logger.info('TransferService::prepare::validationPassed::newEntry')
        // Save the valid transfer into the database
        await TransferService.prepare(payload)
      } catch (err) {
        Logger.error(`TransferService::prepare::validationPassed::Error while preparing transfer::${err.message}`)
        if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
          await consumer.commitMessageSync(message)
        }
        // notification of duplicate to go here
        Logger.info(`TransferService::prepare::validationPassed::send the callback notification for error`)
        // send generic internal error
        message.value.content.payload = Utility.createPrepareErrorStatus(errorInternalCode, errorInternalDescription, message.value.content.payload.extensionList)
        await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE, message.value, Utility.createState(Utility.ENUMS.STATE.FAILURE.status, errorInternalCode, errorInternalDescription))
        return true
      }
      if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
        await consumer.commitMessageSync(message)
      }
      Logger.info('TransferService::prepare::validationPassed::create position topic')
      // position topic to be created and inserted here
      await Utility.produceParticipantMessage(payload.payerFsp, TransferEventType.POSITION, TransferEventAction.PREPARE, message.value, Utility.ENUMS.STATE.SUCCESS)
      return true
    } else {
      Logger.error('TransferService::prepare::validationFailed')
      try {
        Logger.info('TransferService::prepare::validationFailed::newEntry')
        // Save the invalid request in the database
        await TransferService.prepare(payload, reasons.toString(), false)
      } catch (err) {
        Logger.info(`TransferService::prepare::validationFailed::${reasons.toString()}`)
        if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
          await consumer.commitMessageSync(message)
        }
        // notification of duplicate to go here
        Logger.info(`TransferService::prepare::validationFailed::${err.message}`)
        // send generic internal error
        message.value.content.payload = Utility.createPrepareErrorStatus(errorInternalCode, errorInternalDescription, message.value.content.payload.extensionList)
        await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE, message.value, Utility.createState(Utility.ENUMS.STATE.FAILURE.status, errorInternalCode, errorInternalDescription))
        return true
      }
      if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
        await consumer.commitMessageSync(message)
      }
      // log the invalid transfer into the the transferError table
      Logger.info('TransferService::prepare::validationFailed::log the invalid transfer into the the transferError table')
      await TransferService.logTransferError(payload.transferId, errorGenericCode, reasons.toString())

      // send the callback notification for validation error
      Logger.info('TransferService::prepare::validationFailed::send the callback notification for validation error')
      let errorDescription = `${errorGenericDescription}: ${reasons.toString()}`
      message.value.content.payload = Utility.createPrepareErrorStatus(errorGenericCode, errorDescription, message.value.content.payload.extensionList)
      await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE, message.value, Utility.createState(Utility.ENUMS.STATE.FAILURE.status, errorGenericCode, errorDescription))
      return true
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
    Logger.info(`FulfilHandler::${message.value.metadata.event.action}`)
    const kafkaTopic = message.topic
    let consumer
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (e) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(e)
      return true
    }
    const metadata = message.value.metadata
    const transferId = message.value.id
    const payload = message.value.content.payload
    if (metadata.event.type === TransferEventType.FULFIL &&
      (metadata.event.action === TransferEventAction.COMMIT ||
        metadata.event.action === TransferEventAction.REJECT)) {
      const existingTransfer = await TransferService.getById(transferId)

      if (!existingTransfer) {
        Logger.info(`FulfilHandler::${metadata.event.action}::validationFailed::notFound`)
        if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
          await consumer.commitMessageSync(message)
        }
        message.value.content.payload = Utility.createPrepareErrorStatus(errorInternalCode, errorInternalDescription, message.value.content.payload.extensionList)
        await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      } else if (!Validator.validateFulfilCondition(payload.fulfilment, existingTransfer.condition)) {
        Logger.info(`FulfilHandler::${metadata.event.action}::validationFailed::invalidFulfilment`)
        if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
          await consumer.commitMessageSync(message)
        }
        message.value.content.payload = Utility.createPrepareErrorStatus(errorGenericCode, errorGenericDescription, message.value.content.payload.extensionList)
        await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      } else if (existingTransfer.transferState !== TransferState.RESERVED) {
        Logger.info(`FulfilHandler::${metadata.event.action}::validationFailed::nonReservedState`)
        if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
          await consumer.commitMessageSync(message)
        }
        message.value.content.payload = Utility.createPrepareErrorStatus(errorInternalCode, errorInternalDescription, message.value.content.payload.extensionList)
        await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      } else if (existingTransfer.expirationDate <= new Date()) {
        Logger.info(`FulfilHandler::${metadata.event.action}::validationFailed::transferExpired`)
        if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
          await consumer.commitMessageSync(message)
        }
        message.value.content.payload = Utility.createPrepareErrorStatus(errorTransferExpCode, errorTransferExpDescription, message.value.content.payload.extensionList)
        await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, Utility.ENUMS.STATE.FAILURE)
        return true
      } else { // validations success
        Logger.info(`FulfilHandler::${metadata.event.action}::validationPassed`)
        if (metadata.event.action === TransferEventAction.COMMIT) {
          await TransferService.fulfil(transferId, payload)
          if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
            await consumer.commitMessageSync(message)
          }
          await Utility.produceParticipantMessage(existingTransfer.payeeFsp, TransferEventType.POSITION, TransferEventAction.COMMIT, message.value, Utility.ENUMS.STATE.SUCCESS)
          return true
        } else {
          await TransferService.reject(transferId, payload)
          if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
            await consumer.commitMessageSync(message)
          }
          await Utility.produceParticipantMessage(existingTransfer.payerFsp, TransferEventType.POSITION, TransferEventAction.REJECT, message.value, Utility.ENUMS.STATE.SUCCESS)
          return true
        }
      }
    } else {
      Logger.info(`FulfilHandler::${metadata.event.action}::invalidEventAction`)
      if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
        await consumer.commitMessageSync(message)
      }
      message.value.content.payload = Utility.createPrepareErrorStatus(errorInternalCode, errorInternalDescription, message.value.content.payload.extensionList)
      await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, Utility.ENUMS.STATE.FAILURE)
      return true
    }
  } catch (error) {
    Logger.error(error)
    throw error
  }
}

/**
 * @function getTransfer
 *
 * @async
 * @description Gets a transfer by transfer id. Gets Kafka config from default.json
 *
 * Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const getTransfer = async (error, messages) => {
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
    Logger.info(`getTransferHandler::${message.value.metadata.event.action}`)
    const kafkaTopic = message.topic
    let consumer
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (e) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(e)
      return true
    }
    if (!await Validator.validateParticipantByName(message.value.from)) {
      Logger.info('TransferService::getTransferHandler::participantCheck::doesntExist:: FSP Id does not exist')
      if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
        await consumer.commitMessageSync(message)
      }
      return true
    }

    // Validate if the transferId belongs the requesting fsp
    const transferId = message.value.id
    if (!await Validator.validateParticipantTransferId(message.value.from, transferId)) {
      Logger.info('TransferService::getTransferHandler::transferParticipantCheck::doesntMatch:: Transfer Id doesnt belong to the FSP')
      if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
        await consumer.commitMessageSync(message)
      }
      message.value.content.payload = {
        errorInformation: {
          errorCode: 3208,
          errorDescription: 'Provided Transfer ID doesnt belong to the requesting FSP.'
        }
      }
      Logger.info('TransferService::getTransferHandler::participantCheck::doesntExist:: send callback notification')
      await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventType.GET, message.value, Utility.createState(Utility.ENUMS.STATE.FAILURE.status, errorGenericCode, errorGenericDescription))
      return true
    }

    const transfer = await TransferService.getById(transferId)

    if (!transfer) {
      message.value.content.payload = {
        errorInformation: {
          errorCode: 3208,
          errorDescription: 'Provided Transfer ID was not found on the server.'
        }
      }
      Logger.info('TransferService::getTransferHandler::participantCheck::doesntExist:: Provided Transfer ID was not found on the server.')
      if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
        await consumer.commitMessageSync(message)
      }
      Logger.info('TransferService::getTransferHandler::participantCheck::doesntExist:: send callback notification')
      await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventType.GET, message.value, Utility.createState(Utility.ENUMS.STATE.FAILURE.status, errorGenericCode, errorGenericDescription))
      return true
    } else {
      message.value.content.payload = transformTransfer(transfer)
    }
    if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
      await consumer.commitMessageSync(message)
    }
    // Will follow framework flow in future
    await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventType.GET, message.value, Utility.ENUMS.STATE.SUCCESS)
    return true
  } catch (err) {
    Logger.error(err)
    throw err
  }
}

const transformTransfer = (transfer) => {
  if (transfer.transferState === Enum.TransferState.COMMITTED) {
    return {
      fulfilment: transfer.fulfilment,
      completedTimestamp: transfer.completedTimestamp,
      transferState: transfer.transferState,
      extensionList: transfer.extensionList
    }
  } else {
    return {
      transferState: transfer.transferState,
      extensionList: transfer.extensionList
    }
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
      topicName: Utility.transformAccountToTopicName(participantName, TransferEventType.TRANSFER, TransferEventAction.PREPARE),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventAction.PREPARE.toUpperCase())
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
 * @function registerFulfilHandler
 *
 * @async
 * @description Registers the one handler for fulfil transfer. Gets Kafka config from default.json
 * Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerFulfilHandler = async () => {
  try {
    const fulfillHandler = {
      command: fulfil,
      topicName: Utility.transformGeneralTopicName(TransferEventType.TRANSFER, TransferEventType.FULFIL),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventType.FULFIL.toUpperCase())
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
 * @function RegisterPrepareHandlers
 *
 * @async
 * @description Registers the prepare handlers for all participants. Retrieves the list of all participants from the database and loops through each
 * createPrepareHandler called to create the handler for each participant
 * @param {string[]} participantNames - Array of Participants to register
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerPrepareHandlers = async (participantNames = []) => {
  try {
    let participantNamesList
    if (Array.isArray(participantNames) && participantNames.length > 0) {
      participantNamesList = participantNames
    } else {
      participantNamesList = await DAO.retrieveAllParticipants()
    }
    if (participantNamesList.length !== 0) {
      for (let name of participantNamesList) {
        Logger.info(`Registering prepareHandler for Participant: ${name}`)
        await createPrepareHandler(name)
      }
    } else {
      Logger.info('No participants for prepare handler creation')
      return false
    }
    return true
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

/**
 * @function registerGetTransferHandler
 *
 * @async
 * @description Registers the one handler for get a transfer by Id. Gets Kafka config from default.json
 * Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerGetTransferHandler = async () => {
  try {
    const getHandler = {
      command: getTransfer,
      topicName: Utility.transformGeneralTopicName(TransferEventType.TRANSFER, TransferEventType.GET),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventType.GET.toUpperCase())
    }
    getHandler.config.rdkafkaConf['client.id'] = getHandler.topicName
    await Kafka.Consumer.createHandler(getHandler.topicName, getHandler.config, getHandler.command)
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
    await registerFulfilHandler()
    await registerGetTransferHandler()
    return true
  } catch (e) {
    throw e
  }
}

module.exports = {
  registerPrepareHandlers,
  registerFulfilHandler,
  registerAllHandlers,
  registerGetTransferHandler,
  getTransfer,
  prepare,
  fulfil
}
