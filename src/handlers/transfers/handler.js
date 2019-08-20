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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 - Miguel de Barros <miguel.debarros@modusbox.com>
 - Deon Botha <deon.botha@modusbox.com>
 - Shashikant Hirugade <shashikant.hirugade@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @module src/handlers/transfers
 */

const Logger = require('@mojaloop/central-services-shared').Logger
const TransferService = require('../../domain/transfer')
const Util = require('../lib/utility')
const Kafka = require('../lib/kafka')
const Validator = require('./validator')
const Enum = require('../../lib/enum')
const TransferState = Enum.TransferState
const TransferStateEnum = Enum.TransferStateEnum
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction
const TransferObjectTransform = require('../../domain/transfer/transform')
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../lib/config')
const decodePayload = require('@mojaloop/central-services-stream').Kafka.Protocol.decodePayload
const Comparators = require('@mojaloop/central-services-shared').Comparators
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const consumerCommit = true
const fromSwitch = true
const toDestination = true

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
 * TransferObjectTransform.toTransfer called to transform the transfer object
 * TransferService.prepare called and creates new entries in transfer tables for successful prepare transfer
 * TransferService.logTransferError called to log the invalid request
 *
 * @param {error} error - error thrown if something fails within Kafka
 * @param {array} messages - a list of messages to consume for the relevant topic
 *
 * @returns {object} - Returns a boolean: true if successful, or throws and error if failed
 */
const prepare = async (error, messages) => {
  const location = { module: 'PrepareHandler', method: '', path: '' } // var object used as pointer
  const histTimerEnd = Metrics.getHistogram(
    'transfer_prepare',
    'Consume a prepare transfer message from the kafka topic and process it accordingly',
    ['success', 'fspId']
  ).startTimer()
  if (error) {
    throw ErrorHandler.Factory.reformatFSPIOPError(error)
  }
  let message = {}
  try {
    if (Array.isArray(messages)) {
      message = messages[0]
    } else {
      message = messages
    }
    const payload = decodePayload(message.value.content.payload)
    const headers = message.value.content.headers
    const action = message.value.metadata.event.action
    const transferId = payload.transferId
    const kafkaTopic = message.topic
    let consumer
    Logger.info(Util.breadcrumb(location, { method: 'prepare' }))
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (err) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(err)
      histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    const actionLetter = action === TransferEventAction.PREPARE ? Enum.actionLetter.prepare
      : (action === TransferEventAction.BULK_PREPARE ? Enum.actionLetter.bulkPrepare
        : Enum.actionLetter.unknown)
    const params = { message, kafkaTopic, consumer }

    Logger.info(Util.breadcrumb(location, { path: 'dupCheck' }))
    const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(transferId, payload, TransferService.getTransferDuplicateCheck, TransferService.saveTransferDuplicateCheck)

    if (hasDuplicateId && hasDuplicateHash) {
      Logger.info(Util.breadcrumb(location, `handleResend`))
      const transfer = await TransferService.getByIdLight(transferId)
      const transferStateEnum = transfer && transfer.transferStateEnumeration
      if ([TransferStateEnum.COMMITTED, TransferStateEnum.ABORTED].includes(transferStateEnum)) {
        Logger.info(Util.breadcrumb(location, `callbackFinilized1--${actionLetter}1`))
        message.value.content.payload = TransferObjectTransform.toFulfil(transfer)
        message.value.content.uriParams = { id: transferId }

        const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE_DUPLICATE }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, producer, fromSwitch })
      } else {
        Logger.info(Util.breadcrumb(location, `inProgress1--${actionLetter}2`))
        return await Util.proceed(params, { consumerCommit, histTimerEnd })
      }
    } else if (hasDuplicateId && !hasDuplicateHash) {
      Logger.error(Util.breadcrumb(location, `callbackErrorModified1--${actionLetter}3`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST).toApiErrorObject()
      const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE }
      return await Util.proceed(params, { consumerCommit, histTimerEnd, fspiopError, producer, fromSwitch })
    } else { // !hasDuplicateId
      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)
      if (validationPassed) {
        Logger.info(Util.breadcrumb(location, { path: 'validationPassed' }))
        try {
          Logger.info(Util.breadcrumb(location, `saveTransfer`))
          await TransferService.prepare(payload)
        } catch (err) {
          Logger.info(Util.breadcrumb(location, `callbackErrorInternal1--${actionLetter}4`))
          Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
          const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError().toApiErrorObject()
          const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE }
          return await Util.proceed(params, { consumerCommit, histTimerEnd, fspiopError, producer, fromSwitch })
        }
        Logger.info(Util.breadcrumb(location, `positionTopic1--${actionLetter}5`))
        const producer = { functionality: TransferEventType.POSITION, action }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, producer, toDestination })
      } else {
        Logger.error(Util.breadcrumb(location, { path: 'validationFailed' }))
        try {
          Logger.info(Util.breadcrumb(location, `saveInvalidRequest`))
          await TransferService.prepare(payload, reasons.toString(), false)
        } catch (err) {
          Logger.info(Util.breadcrumb(location, `callbackErrorInternal2--${actionLetter}6`))
          Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
          const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError().toApiErrorObject()
          const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE }
          return await Util.proceed(params, { consumerCommit, histTimerEnd, fspiopError, producer, fromSwitch })
        }
        Logger.info(Util.breadcrumb(location, `callbackErrorGeneric--${actionLetter}7`))
        await TransferService.logTransferError(transferId, ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR.code, reasons.toString())
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR).toApiErrorObject()
        const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, fspiopError, producer, fromSwitch })
      }
    }
  } catch (err) {
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    throw ErrorHandler.Factory.createInternalServerFSPIOPError(`${Util.breadcrumb(location)}::${err.message}--P0`, err)
  }
}

const fulfil = async (error, messages) => {
  const location = { module: 'FulfilHandler', method: '', path: '' } // var object used as pointer
  const histTimerEnd = Metrics.getHistogram(
    'transfer_fulfil',
    'Consume a fulfil transfer message from the kafka topic and process it accordingly',
    ['success', 'fspId']
  ).startTimer()
  if (error) {
    throw ErrorHandler.Factory.reformatFSPIOPError(error)
  }
  let message = {}
  try {
    if (Array.isArray(messages)) {
      message = messages[0]
    } else {
      message = messages
    }
    const payload = decodePayload(message.value.content.payload)
    const headers = message.value.content.headers
    const action = message.value.metadata.event.action
    const transferId = message.value.content.uriParams.id
    const kafkaTopic = message.topic
    const isFulfilment = true
    let consumer
    Logger.info(Util.breadcrumb(location, { method: `fulfil:${action}` }))
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (e) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(e)
      histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    const actionLetter = action === TransferEventAction.COMMIT ? Enum.actionLetter.commit
      : (action === TransferEventAction.REJECT ? Enum.actionLetter.reject
        : (action === TransferEventAction.ABORT ? Enum.actionLetter.abort
          : (action === TransferEventAction.BULK_COMMIT ? Enum.actionLetter.bulkCommit
            : Enum.actionLetter.unknown)))
    // fulfil-specific declarations
    const isTransferError = action === TransferEventAction.ABORT
    const params = { message, transferId, kafkaTopic, consumer }

    Logger.info(Util.breadcrumb(location, { path: 'getById' }))
    const transfer = await TransferService.getById(transferId)
    const transferStateEnum = transfer && transfer.transferStateEnumeration

    if (!transfer) {
      Logger.error(Util.breadcrumb(location, `callbackInternalServerErrorNotFound--${actionLetter}1`))
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError('transfer not found').toApiErrorObject()
      const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.COMMIT }
      return await Util.proceed(params, { consumerCommit, histTimerEnd, fspiopError, producer, fromSwitch })
    } else if (headers[Enum.headers.FSPIOP.SOURCE].toLowerCase() !== transfer.payeeFsp.toLowerCase()) {
      /**
       * If fulfilment request is coming from a source not matching transfer payee fsp,
       * don't proceed the request, but rather send error callback to original payee fsp.
       * This is also the reason why we need to retrieve the transfer info upfront now.
       */
      Logger.info(Util.breadcrumb(location, `callbackErrorSourceNotMatchingPayeeFsp--${actionLetter}2`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `${Enum.headers.FSPIOP.SOURCE} does not match payee fsp`).toApiErrorObject()
      const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.COMMIT }
      const toDestination = transfer.payeeFsp // overrding global boolean declaration with string value for local use only
      return await Util.proceed(params, { consumerCommit, histTimerEnd, fspiopError, producer, fromSwitch, toDestination })
    }
    // If execution continues after this point we are now sure transfer exists and source matches payee fsp

    Logger.info(Util.breadcrumb(location, { path: 'dupCheck' }))
    let dupCheckResult
    if (!isTransferError) {
      dupCheckResult = await Comparators.duplicateCheckComparator(transferId, payload, TransferService.getTransferFulfilmentDuplicateCheck, TransferService.saveTransferFulfilmentDuplicateCheck)
    } else {
      dupCheckResult = await Comparators.duplicateCheckComparator(transferId, payload, TransferService.getTransferErrorDuplicateCheck, TransferService.saveTransferErrorDuplicateCheck)
    }
    const { hasDuplicateId, hasDuplicateHash } = dupCheckResult

    if (hasDuplicateId && hasDuplicateHash) {
      Logger.info(Util.breadcrumb(location, `handleResend`))
      if (transferStateEnum === TransferStateEnum.COMMITTED || transferStateEnum === TransferStateEnum.ABORTED) {
        message.value.content.payload = TransferObjectTransform.toFulfil(transfer)
        if (!isTransferError) {
          Logger.info(Util.breadcrumb(location, `callbackFinilized2--${actionLetter}3`))
          const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.FULFIL_DUPLICATE }
          return await Util.proceed(params, { consumerCommit, histTimerEnd, producer, fromSwitch })
        } else {
          Logger.info(Util.breadcrumb(location, `callbackFinilized3--${actionLetter}4`))
          const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.ABORT_DUPLICATE }
          return await Util.proceed(params, { consumerCommit, histTimerEnd, producer, fromSwitch })
        }
      } else if (transferStateEnum === TransferStateEnum.RECEIVED || transferStateEnum === TransferStateEnum.RESERVED) {
        Logger.info(Util.breadcrumb(location, `inProgress2--${actionLetter}5`))
        return await Util.proceed(params, { consumerCommit, histTimerEnd })
      }
    } else if (hasDuplicateId && !hasDuplicateHash) {
      let producer
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST).toApiErrorObject()
      if (!isTransferError) {
        Logger.info(Util.breadcrumb(location, `callbackErrorModified2--${actionLetter}6`))
        producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.FULFIL_DUPLICATE }
      } else {
        Logger.info(Util.breadcrumb(location, `callbackErrorModified3--${actionLetter}7`))
        producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.ABORT_DUPLICATE }
      }
      return await Util.proceed(params, { consumerCommit, histTimerEnd, fspiopError, producer, fromSwitch })
    } else { // !hasDuplicateId
      if (message.value.metadata.event.type === TransferEventType.FULFIL && [TransferEventAction.COMMIT, TransferEventAction.REJECT, TransferEventAction.ABORT, TransferEventAction.BULK_COMMIT].includes(action)) {
        Util.breadcrumb(location, { path: 'validationFailed' })
        if (payload.fulfilment && !Validator.validateFulfilCondition(payload.fulfilment, transfer.condition)) {
          // TODO: Finalizing a transfer on receiving an incorrect Fulfilment value #703
          Logger.info(Util.breadcrumb(location, `callbackErrorInvalidFulfilment--${actionLetter}8`))
          const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'invalid fulfilment').toApiErrorObject()
          const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.COMMIT }
          return await Util.proceed(params, { consumerCommit, histTimerEnd, fspiopError, producer, fromSwitch })
        } else if (transfer.transferState !== TransferState.RESERVED) {
          Logger.info(Util.breadcrumb(location, `callbackErrorNonReservedState--${actionLetter}9`))
          const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'non-RESERVED transfer state').toApiErrorObject()
          const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.COMMIT }
          return await Util.proceed(params, { consumerCommit, histTimerEnd, fspiopError, producer, fromSwitch })
        } else if (transfer.expirationDate <= new Date()) {
          Logger.info(Util.breadcrumb(location, `callbackErrorTransferExpired--${actionLetter}10`))
          // TODO: Previously thrown code was 3300, now - 3303
          const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED).toApiErrorObject()
          const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.COMMIT }
          return await Util.proceed(params, { consumerCommit, histTimerEnd, fspiopError, producer, fromSwitch })
        } else { // validations success
          Logger.info(Util.breadcrumb(location, { path: 'validationPassed' }))
          if ([TransferEventAction.COMMIT, TransferEventAction.BULK_COMMIT].includes(action)) {
            Logger.info(Util.breadcrumb(location, `positionTopic2--${actionLetter}11`))
            await TransferService.fulfil(transferId, payload)
            const producer = { functionality: TransferEventType.POSITION, action }
            return await Util.proceed(params, { consumerCommit, histTimerEnd, producer, toDestination })
          } else {
            if (action === TransferEventAction.REJECT) {
              Logger.info(Util.breadcrumb(location, `positionTopic3--${actionLetter}12`))
              await TransferService.reject(transferId, payload)
              const producer = { functionality: TransferEventType.POSITION, action: TransferEventAction.REJECT }
              return await Util.proceed(params, { consumerCommit, histTimerEnd, producer, toDestination })
            } else { // action === TransferEventAction.ABORT
              Logger.info(Util.breadcrumb(location, `positionTopic4--${actionLetter}13`))
              const abortResult = await TransferService.abort(transferId, payload)
              const TER = abortResult.transferErrorRecord
              const producer = { functionality: TransferEventType.POSITION, action: TransferEventAction.ABORT }
              const fspiopError = ErrorHandler.Factory.createFSPIOPErrorFromErrorCode(TER.errorCode, TER.errorDescription).toApiErrorObject()
              return await Util.proceed(params, { consumerCommit, histTimerEnd, fspiopError, producer, toDestination })
            }
          }
        }
      } else {
        Logger.info(Util.breadcrumb(location, `callbackErrorInvalidEventAction--${actionLetter}14`))
        const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError().toApiErrorObject()
        const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.COMMIT }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, fspiopError, producer, fromSwitch })
      }
    }
  } catch (err) {
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    throw ErrorHandler.Factory.createInternalServerFSPIOPError(`${Util.breadcrumb(location)}::${err.message}--F0`, err)
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
  const location = { module: 'GetTransferHandler', method: '', path: '' } // var object used as pointer
  const histTimerEnd = Metrics.getHistogram(
    'transfer_get',
    'Consume a get transfer message from the kafka topic and process it accordingly',
    ['success', 'fspId']
  ).startTimer()
  if (error) {
    throw ErrorHandler.Factory.reformatFSPIOPError(error)
  }
  let message = {}
  try {
    if (Array.isArray(messages)) {
      message = messages[0]
    } else {
      message = messages
    }
    const metadata = message.value.metadata
    const action = metadata.event.action
    const transferId = message.value.content.uriParams.id
    const kafkaTopic = message.topic
    let consumer
    Logger.info(Util.breadcrumb(location, { method: `getTransfer:${action}` }))
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (e) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(e)
      histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    const actionLetter = Enum.actionLetter.get
    const params = { message, transferId, kafkaTopic, consumer }
    const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.GET }

    Util.breadcrumb(location, { path: 'validationFailed' })
    if (!await Validator.validateParticipantByName(message.value.from)) {
      Logger.info(Util.breadcrumb(location, `breakParticipantDoesntExist--${actionLetter}1`))
      return await Util.proceed(params, { consumerCommit, histTimerEnd })
    }
    // TODO: we might need getByIdLight and validateParticipantTransferId for prepares and fulfils
    const transfer = await TransferService.getByIdLight(transferId)
    if (!transfer) {
      Logger.info(Util.breadcrumb(location, `callbackErrorTransferNotFound--${actionLetter}3`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_ID_NOT_FOUND, 'Provided Transfer ID was not found on the server.').toApiErrorObject()
      return await Util.proceed(params, { consumerCommit, histTimerEnd, fspiopError, producer, fromSwitch })
    }
    if (!await Validator.validateParticipantTransferId(message.value.from, transferId)) {
      Logger.info(Util.breadcrumb(location, `callbackErrorNotTransferParticipant--${actionLetter}2`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR).toApiErrorObject()
      return await Util.proceed(params, { consumerCommit, histTimerEnd, fspiopError, producer, fromSwitch })
    }
    // ============================================================================================
    Util.breadcrumb(location, { path: 'validationPassed' })
    Logger.info(Util.breadcrumb(location, `callbackMessage--${actionLetter}4`))
    message.value.content.payload = TransferObjectTransform.toFulfil(transfer)
    return await Util.proceed(params, { consumerCommit, histTimerEnd, producer, fromSwitch })
  } catch (err) {
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    throw ErrorHandler.Factory.createInternalServerFSPIOPError(`${Util.breadcrumb(location)}::${err.message}--G0`, err)
  }
}

/**
 * @function registerPrepareHandler
 *
 * @async
 * @description Registers the handler for prepare topic. Gets Kafka config from default.json
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerPrepareHandler = async () => {
  try {
    const prepareHandler = {
      command: prepare,
      topicName: Util.transformGeneralTopicName(TransferEventType.TRANSFER, TransferEventAction.PREPARE),
      config: Util.getKafkaConfig(Util.ENUMS.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventAction.PREPARE.toUpperCase())
    }
    prepareHandler.config.rdkafkaConf['client.id'] = prepareHandler.topicName
    await Kafka.Consumer.createHandler(prepareHandler.topicName, prepareHandler.config, prepareHandler.command)
    return true
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
      topicName: Util.transformGeneralTopicName(TransferEventType.TRANSFER, TransferEventType.FULFIL),
      config: Util.getKafkaConfig(Util.ENUMS.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventType.FULFIL.toUpperCase())
    }
    fulfillHandler.config.rdkafkaConf['client.id'] = fulfillHandler.topicName
    await Kafka.Consumer.createHandler(fulfillHandler.topicName, fulfillHandler.config, fulfillHandler.command)
    return true
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
      topicName: Util.transformGeneralTopicName(TransferEventType.TRANSFER, TransferEventType.GET),
      config: Util.getKafkaConfig(Util.ENUMS.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventType.GET.toUpperCase())
    }
    getHandler.config.rdkafkaConf['client.id'] = getHandler.topicName
    await Kafka.Consumer.createHandler(getHandler.topicName, getHandler.config, getHandler.command)
    return true
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
    await registerPrepareHandler()
    await registerFulfilHandler()
    await registerGetTransferHandler()
    return true
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  prepare,
  fulfil,
  getTransfer,
  registerPrepareHandler,
  registerFulfilHandler,
  registerGetTransferHandler,
  registerAllHandlers
}
