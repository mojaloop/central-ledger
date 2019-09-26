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

const Logger = require('@mojaloop/central-services-logger')
const EventSdk = require('@mojaloop/event-sdk')
const TransferService = require('../../domain/transfer')
const Util = require('@mojaloop/central-services-shared').Util
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Producer = require('@mojaloop/central-services-stream').Util.Producer
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Validator = require('./validator')
const Enum = require('@mojaloop/central-services-shared').Enum
const TransferState = Enum.Transfers.TransferState
const TransferEventType = Enum.Events.Event.Type
const TransferEventAction = Enum.Events.Event.Action
const TransferObjectTransform = require('../../domain/transfer/transform')
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../lib/config')
const decodePayload = require('@mojaloop/central-services-shared').Util.StreamingProtocol.decodePayload
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators
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
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    throw ErrorHandler.Factory.reformatFSPIOPError(error)
  }
  let message = {}
  if (Array.isArray(messages)) {
    message = messages[0]
  } else {
    message = messages
  }
  const parentSpanService = 'cl_transfer_prepare'
  const contextFromMessage = EventSdk.Tracer.extractContextFromMessage(message.value)
  const span = EventSdk.Tracer.createChildSpanFromContext(parentSpanService, contextFromMessage)
  try {
    const payload = decodePayload(message.value.content.payload)
    const headers = message.value.content.headers
    const action = message.value.metadata.event.action
    const transferId = payload.transferId
    span.setTags({ transactionId: transferId })
    await span.audit(message, EventSdk.AuditEventAction.start)
    const kafkaTopic = message.topic
    Logger.info(Util.breadcrumb(location, { method: 'prepare' }))

    const actionLetter = action === TransferEventAction.PREPARE ? Enum.Events.ActionLetter.prepare
      : (action === TransferEventAction.BULK_PREPARE ? Enum.Events.ActionLetter.bulkPrepare
        : Enum.Events.ActionLetter.unknown)
    const params = { message, kafkaTopic, span, consumer: Consumer, producer: Producer }

    Logger.info(Util.breadcrumb(location, { path: 'dupCheck' }))

    const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(transferId, payload, TransferService.getTransferDuplicateCheck, TransferService.saveTransferDuplicateCheck)
    if (hasDuplicateId && hasDuplicateHash) {
      Logger.info(Util.breadcrumb(location, 'handleResend'))
      const transfer = await TransferService.getByIdLight(transferId)
      const transferStateEnum = transfer && transfer.transferStateEnumeration
      if ([TransferState.COMMITTED, TransferState.ABORTED].includes(transferStateEnum)) {
        Logger.info(Util.breadcrumb(location, `callbackFinilized1--${actionLetter}1`))
        message.value.content.payload = TransferObjectTransform.toFulfil(transfer)
        message.value.content.uriParams = { id: transferId }
        const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE_DUPLICATE }
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      } else {
        Logger.info(Util.breadcrumb(location, `inProgress1--${actionLetter}2`))
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
    } else if (hasDuplicateId && !hasDuplicateHash) {
      Logger.error(Util.breadcrumb(location, `callbackErrorModified1--${actionLetter}3`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST)
      const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE }
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError
    } else { // !hasDuplicateId
      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)
      if (validationPassed) {
        Logger.info(Util.breadcrumb(location, { path: 'validationPassed' }))
        try {
          Logger.info(Util.breadcrumb(location, 'saveTransfer'))
          await TransferService.prepare(payload)
        } catch (err) {
          Logger.info(Util.breadcrumb(location, `callbackErrorInternal1--${actionLetter}4`))
          Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
          const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err, ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
          const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE }
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
          throw fspiopError
        }
        Logger.info(Util.breadcrumb(location, `positionTopic1--${actionLetter}5`))
        const eventDetail = { functionality: TransferEventType.POSITION, action }
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, toDestination })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      } else {
        Logger.error(Util.breadcrumb(location, { path: 'validationFailed' }))
        try {
          Logger.info(Util.breadcrumb(location, 'saveInvalidRequest'))
          await TransferService.prepare(payload, reasons.toString(), false)
        } catch (err) {
          Logger.info(Util.breadcrumb(location, `callbackErrorInternal2--${actionLetter}6`))
          Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
          const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err, ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
          const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE }
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
          throw fspiopError
        }
        Logger.info(Util.breadcrumb(location, `callbackErrorGeneric--${actionLetter}7`))
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, reasons.toString())
        await TransferService.logTransferError(transferId, ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR.code, reasons.toString())
        let functionality
        if (action === TransferEventAction.PREPARE) {
          functionality = TransferEventType.NOTIFICATION
        } else { // action === TransferEventAction.BULK_PREPARE
          functionality = TransferEventType.BULK_PROCESSING
        }
        const eventDetail = { functionality, action }
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
        throw fspiopError
      }
    }
  } catch (err) {
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
    Logger.error(`${Util.breadcrumb(location)}::${err.message}--P0`)
    const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
    await span.error(fspiopError, state)
    await span.finish(fspiopError.message, state)
    return true
  } finally {
    if (!span.isFinished) {
      await span.finish()
    }
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
  if (Array.isArray(messages)) {
    message = messages[0]
  } else {
    message = messages
  }
  const contextFromMessage = EventSdk.Tracer.extractContextFromMessage(message.value)
  const span = EventSdk.Tracer.createChildSpanFromContext('cl_transfer_fulfil', contextFromMessage)
  try {
    await span.audit(message, EventSdk.AuditEventAction.start)
    const payload = decodePayload(message.value.content.payload)
    const headers = message.value.content.headers
    const type = message.value.metadata.event.type
    const action = message.value.metadata.event.action
    const transferId = message.value.content.uriParams.id
    const kafkaTopic = message.topic
    Logger.info(Util.breadcrumb(location, { method: `fulfil:${action}` }))

    const actionLetter = action === TransferEventAction.COMMIT ? Enum.Events.ActionLetter.commit
      : (action === TransferEventAction.REJECT ? Enum.Events.ActionLetter.reject
        : (action === TransferEventAction.ABORT ? Enum.Events.ActionLetter.abort
          : (action === TransferEventAction.BULK_COMMIT ? Enum.Events.ActionLetter.bulkCommit
            : Enum.Events.ActionLetter.unknown)))
    // fulfil-specific declarations
    const isTransferError = action === TransferEventAction.ABORT
    const params = { message, transferId, kafkaTopic, span, consumer: Consumer, producer: Producer }

    Logger.info(Util.breadcrumb(location, { path: 'getById' }))
    const transfer = await TransferService.getById(transferId)
    const transferStateEnum = transfer && transfer.transferStateEnumeration

    if (!transfer) {
      Logger.error(Util.breadcrumb(location, `callbackInternalServerErrorNotFound--${actionLetter}1`))
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError('transfer not found')
      const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.COMMIT }
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError
    } else if (headers[Enum.Http.Headers.FSPIOP.SOURCE].toLowerCase() !== transfer.payeeFsp.toLowerCase()) {
      /**
       * If fulfilment request is coming from a source not matching transfer payee fsp,
       * don't proceed the request, but rather send error callback to original payee fsp.
       * This is also the reason why we need to retrieve the transfer info upfront now.
       */
      Logger.info(Util.breadcrumb(location, `callbackErrorSourceNotMatchingPayeeFsp--${actionLetter}2`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `${Enum.Http.Headers.FSPIOP.SOURCE} does not match payee fsp`)
      const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.COMMIT }
      const toDestination = transfer.payeeFsp // overrding global boolean declaration with string value for local use only
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, toDestination })
      throw fspiopError
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
      Logger.info(Util.breadcrumb(location, 'handleResend'))
      if (transferStateEnum === TransferState.COMMITTED || transferStateEnum === TransferState.ABORTED) {
        message.value.content.payload = TransferObjectTransform.toFulfil(transfer)
        if (!isTransferError) {
          Logger.info(Util.breadcrumb(location, `callbackFinilized2--${actionLetter}3`))
          const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.FULFIL_DUPLICATE }
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          return true
        } else {
          Logger.info(Util.breadcrumb(location, `callbackFinilized3--${actionLetter}4`))
          const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.ABORT_DUPLICATE }
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          return true
        }
      } else if (transferStateEnum === TransferState.RECEIVED || transferStateEnum === TransferState.RESERVED) {
        Logger.info(Util.breadcrumb(location, `inProgress2--${actionLetter}5`))
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, histTimerEnd })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      } else {
        Logger.info(Util.breadcrumb(location, `callbackErrorInvalidTransferStateEnum--${actionLetter}6`))
        const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(
          `Invalid transferStateEnumeration:(${transferStateEnum}) for event action:(${action}) and type:(${type})`).toApiErrorObject(Config.ERROR_HANDLING)
        const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.COMMIT }
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError, eventDetail, fromSwitch })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
    } else if (hasDuplicateId && !hasDuplicateHash) {
      let eventDetail
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST)
      if (!isTransferError) {
        Logger.info(Util.breadcrumb(location, `callbackErrorModified2--${actionLetter}7`))
        eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.FULFIL_DUPLICATE }
      } else {
        Logger.info(Util.breadcrumb(location, `callbackErrorModified3--${actionLetter}8`))
        eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.ABORT_DUPLICATE }
      }
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError
    } else { // !hasDuplicateId
      if (type === TransferEventType.FULFIL && [TransferEventAction.COMMIT, TransferEventAction.REJECT, TransferEventAction.ABORT, TransferEventAction.BULK_COMMIT].includes(action)) {
        Util.breadcrumb(location, { path: 'validationFailed' })
        if (payload.fulfilment && !Validator.validateFulfilCondition(payload.fulfilment, transfer.condition)) {
          Logger.info(Util.breadcrumb(location, `callbackErrorInvalidFulfilment--${actionLetter}9`))
          const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'invalid fulfilment')
          await TransferService.handlePayeeResponse(transferId, payload, action, fspiopError)
          const eventDetail = { functionality: TransferEventType.POSITION, action: TransferEventAction.ABORT }
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, toDestination })
          throw fspiopError
        } else if (transfer.transferState !== TransferState.RESERVED) {
          Logger.info(Util.breadcrumb(location, `callbackErrorNonReservedState--${actionLetter}10`))
          const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'non-RESERVED transfer state')
          const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.COMMIT }
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
          throw fspiopError
        } else if (transfer.expirationDate <= new Date(Util.Time.getUTCString(new Date()))) {
          Logger.info(Util.breadcrumb(location, `callbackErrorTransferExpired--${actionLetter}11`))
          const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED)
          const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.COMMIT }
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
          throw fspiopError
        } else { // validations success
          Logger.info(Util.breadcrumb(location, { path: 'validationPassed' }))
          if ([TransferEventAction.COMMIT, TransferEventAction.BULK_COMMIT].includes(action)) {
            Logger.info(Util.breadcrumb(location, `positionTopic2--${actionLetter}12`))
            await TransferService.handlePayeeResponse(transferId, payload, action)
            const eventDetail = { functionality: TransferEventType.POSITION, action }
            await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, toDestination })
            histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
            return true
          } else {
            if (action === TransferEventAction.REJECT) {
              Logger.info(Util.breadcrumb(location, `positionTopic3--${actionLetter}13`))
              await TransferService.handlePayeeResponse(transferId, payload, action)
              const eventDetail = { functionality: TransferEventType.POSITION, action: TransferEventAction.REJECT }
              await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, toDestination })
              histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
              return true
            } else { // action === TransferEventAction.ABORT // error-callback request to be processed
              Logger.info(Util.breadcrumb(location, `positionTopic4--${actionLetter}14`))
              let fspiopError
              const eInfo = payload.errorInformation
              try { // handle only valid errorCodes provided by the payee
                fspiopError = ErrorHandler.Factory.createFSPIOPErrorFromErrorInformation(eInfo)
              } catch (err) {
                /**
                 * TODO: Handling of out-of-range errorCodes is to be introduced to the ml-api-adapter,
                 * so that such requests are rejected right away, instead of aborting the transfer here.
                 */
                fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'API specification undefined errorCode')
                await TransferService.handlePayeeResponse(transferId, payload, action, fspiopError.toApiErrorObject(Config.ERROR_HANDLING))
                const eventDetail = { functionality: TransferEventType.POSITION, action: TransferEventAction.ABORT }
                await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, toDestination })
                throw fspiopError
              }
              await TransferService.handlePayeeResponse(transferId, payload, action, fspiopError.toApiErrorObject(Config.ERROR_HANDLING))
              const eventDetail = { functionality: TransferEventType.POSITION, action: TransferEventAction.ABORT }
              await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, toDestination })
              throw fspiopError
            }
          }
        }
      } else {
        Logger.info(Util.breadcrumb(location, `callbackErrorInvalidEventAction--${actionLetter}15`))
        const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(`Invalid event action:(${action}) and/or type:(${type})`)
        const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.COMMIT }
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
        throw fspiopError
      }
    }
  } catch (err) {
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
    Logger.error(`${Util.breadcrumb(location)}::${err.message}--F0`)
    const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
    await span.error(fspiopError, state)
    await span.finish(fspiopError.message, state)
    return true
  } finally {
    if (!span.isFinished) {
      await span.finish()
    }
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
  if (Array.isArray(messages)) {
    message = messages[0]
  } else {
    message = messages
  }
  const contextFromMessage = EventSdk.Tracer.extractContextFromMessage(message.value)
  const span = EventSdk.Tracer.createChildSpanFromContext('cl_transfer_get', contextFromMessage)
  try {
    await span.audit(message, EventSdk.AuditEventAction.start)
    const metadata = message.value.metadata
    const action = metadata.event.action
    const transferId = message.value.content.uriParams.id
    const kafkaTopic = message.topic
    Logger.info(Util.breadcrumb(location, { method: `getTransfer:${action}` }))

    const actionLetter = Enum.Events.ActionLetter.get
    const params = { message, transferId, kafkaTopic, span, consumer: Consumer, producer: Producer }
    const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.GET }

    Util.breadcrumb(location, { path: 'validationFailed' })
    if (!await Validator.validateParticipantByName(message.value.from)) {
      Logger.info(Util.breadcrumb(location, `breakParticipantDoesntExist--${actionLetter}1`))
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, histTimerEnd })
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    const transfer = await TransferService.getByIdLight(transferId)
    if (!transfer) {
      Logger.info(Util.breadcrumb(location, `callbackErrorTransferNotFound--${actionLetter}3`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_ID_NOT_FOUND, 'Provided Transfer ID was not found on the server.')
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError
    }
    if (!await Validator.validateParticipantTransferId(message.value.from, transferId)) {
      Logger.info(Util.breadcrumb(location, `callbackErrorNotTransferParticipant--${actionLetter}2`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR)
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError
    }
    // ============================================================================================
    Util.breadcrumb(location, { path: 'validationPassed' })
    Logger.info(Util.breadcrumb(location, `callbackMessage--${actionLetter}4`))
    message.value.content.payload = TransferObjectTransform.toFulfil(transfer)
    await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch })
    histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    return true
  } catch (err) {
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
    Logger.error(`${Util.breadcrumb(location)}::${err.message}--G0`)
    const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
    await span.error(fspiopError, state)
    await span.finish(fspiopError.message, state)
    return true
  } finally {
    if (!span.isFinished) {
      await span.finish()
    }
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
      topicName: Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, TransferEventType.TRANSFER, TransferEventAction.PREPARE),
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventAction.PREPARE.toUpperCase())
    }
    prepareHandler.config.rdkafkaConf['client.id'] = prepareHandler.topicName
    await Consumer.createHandler(prepareHandler.topicName, prepareHandler.config, prepareHandler.command)
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
      topicName: Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, TransferEventType.TRANSFER, TransferEventType.FULFIL),
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventType.FULFIL.toUpperCase())
    }
    fulfillHandler.config.rdkafkaConf['client.id'] = fulfillHandler.topicName
    await Consumer.createHandler(fulfillHandler.topicName, fulfillHandler.config, fulfillHandler.command)
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
      topicName: Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, TransferEventType.TRANSFER, TransferEventType.GET),
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventType.GET.toUpperCase())
    }
    getHandler.config.rdkafkaConf['client.id'] = getHandler.topicName
    await Consumer.createHandler(getHandler.topicName, getHandler.config, getHandler.command)
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
