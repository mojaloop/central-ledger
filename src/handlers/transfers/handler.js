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
 - Georgi Logodazhki <georgi.logodazhki@modusbox.com>
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
const decodePayload = Util.StreamingProtocol.decodePayload
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Participant = require('../../domain/participant')

const consumerCommit = true
const fromSwitch = true

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
 * Validator.validatePrepare called to validate the payload of the message
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
  const location = { module: 'PrepareHandler', method: '', path: '' }
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
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { method: 'prepare' }))

    const actionLetter = action === TransferEventAction.PREPARE
      ? Enum.Events.ActionLetter.prepare
      : (action === TransferEventAction.BULK_PREPARE
          ? Enum.Events.ActionLetter.bulkPrepare
          : Enum.Events.ActionLetter.unknown)

    let functionality = action === TransferEventAction.PREPARE
      ? TransferEventType.NOTIFICATION
      : (action === TransferEventAction.BULK_PREPARE
          ? TransferEventType.BULK_PROCESSING
          : Enum.Events.ActionLetter.unknown)
    const params = { message, kafkaTopic, decodedPayload: payload, span, consumer: Consumer, producer: Producer }

    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'dupCheck' }))
    const histTimerDuplicateCheckEnd = Metrics.getHistogram(
      'handler_transfers',
      'prepare_duplicateCheckComparator - Metrics for transfer handler',
      ['success', 'funcName']
    ).startTimer()

    const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(transferId, payload, TransferService.getTransferDuplicateCheck, TransferService.saveTransferDuplicateCheck)
    histTimerDuplicateCheckEnd({ success: true, funcName: 'prepare_duplicateCheckComparator' })
    if (hasDuplicateId && hasDuplicateHash) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, 'handleResend'))
      const transfer = await TransferService.getByIdLight(transferId)
      const transferStateEnum = transfer && transfer.transferStateEnumeration
      const eventDetail = { functionality, action: TransferEventAction.PREPARE_DUPLICATE }
      if ([TransferState.COMMITTED, TransferState.ABORTED].includes(transferStateEnum)) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, 'finalized'))
        if (action === TransferEventAction.PREPARE) {
          Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callback--${actionLetter}1`))
          message.value.content.payload = TransferObjectTransform.toFulfil(transfer)
          message.value.content.uriParams = { id: transferId }
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          return true
        } else if (action === TransferEventAction.BULK_PREPARE) {
          Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `validationError1--${actionLetter}2`))
          const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST, 'Individual transfer prepare duplicate')
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
          throw fspiopError
        }
      } else {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, 'inProgress'))
        if (action === TransferEventAction.BULK_PREPARE) {
          Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `validationError2--${actionLetter}4`))
          const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST, 'Individual transfer prepare duplicate')
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
          throw fspiopError
        } else { // action === TransferEventAction.PREPARE
          Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `ignore--${actionLetter}3`))
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          return true
        }
      }
    } else if (hasDuplicateId && !hasDuplicateHash) {
      Logger.isErrorEnabled && Logger.error(Util.breadcrumb(location, `callbackErrorModified1--${actionLetter}5`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST)
      const eventDetail = { functionality, action }
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError
    } else { // !hasDuplicateId
      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      if (validationPassed) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'validationPassed' }))
        try {
          Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, 'saveTransfer'))
          await TransferService.prepare(payload)
        } catch (err) {
          Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorInternal1--${actionLetter}6`))
          Logger.isErrorEnabled && Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
          const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err, ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
          const eventDetail = { functionality, action: TransferEventAction.PREPARE }
          /**
           * TODO: BULK-Handle at BulkProcessingHandler (not in scope of #967)
           * HOWTO: Stop execution at the `TransferService.prepare`, stop mysql,
           * continue execution to catch block, start mysql
           */
          Logger.isErrorEnabled && Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
          throw fspiopError
        }
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `positionTopic1--${actionLetter}7`))
        functionality = TransferEventType.POSITION
        const eventDetail = { functionality, action }
        // Key position prepare message with payer account id
        const payerAccount = await Participant.getAccountByNameAndCurrency(payload.payerFsp, payload.amount.currency, Enum.Accounts.LedgerAccountType.POSITION)
        // We route bulk-prepare and prepare messages differently based on the topic configured for it.
        // Note: The batch handler does not currently support bulk-prepare messages, only prepare messages are supported.
        // Therefore, it is necessary to check the action to determine the topic to route to.
        const topicNameOverride =
          action === TransferEventAction.BULK_PREPARE
            ? Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.BULK_PREPARE
            : Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.PREPARE
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, messageKey: payerAccount.participantCurrencyId.toString(), topicNameOverride })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      } else {
        Logger.isErrorEnabled && Logger.error(Util.breadcrumb(location, { path: 'validationFailed' }))
        try {
          Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, 'saveInvalidRequest'))
          await TransferService.prepare(payload, reasons.toString(), false)
        } catch (err) {
          Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorInternal2--${actionLetter}8`))
          Logger.isErrorEnabled && Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
          const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err, ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
          const eventDetail = { functionality, action: TransferEventAction.PREPARE }
          /**
           * TODO: BULK-Handle at BulkProcessingHandler (not in scope of #967)
           * HOWTO: For regular transfers this branch may be triggered by sending
           * a transfer in a currency not supported by either dfsp and also stopping
           * mysql at `TransferService.prepare` and starting it after entring catch.
           * Not sure if it will work for bulk, because of the BulkPrepareHandler.
           */
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
          throw fspiopError
        }
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorGeneric--${actionLetter}9`))
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, reasons.toString())
        await TransferService.logTransferError(transferId, ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR.code, reasons.toString())
        const eventDetail = { functionality, action }
        /**
         * TODO: BULK-Handle at BulkProcessingHandler (not in scope of #967)
         * HOWTO: For regular transfers this branch may be triggered by sending
         * a tansfer in a currency not supported by either dfsp. Not sure if it
         * will be triggered for bulk, because of the BulkPrepareHandler.
         */
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
        throw fspiopError
      }
    }
  } catch (err) {
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
    Logger.isErrorEnabled && Logger.error(`${Util.breadcrumb(location)}::${err.message}--P0`)
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
  const location = { module: 'FulfilHandler', method: '', path: '' }
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
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { method: `fulfil:${action}` }))

    const actionLetter = (() => {
      switch (action) {
        case TransferEventAction.COMMIT: return Enum.Events.ActionLetter.commit
        case TransferEventAction.RESERVE: return Enum.Events.ActionLetter.reserve
        case TransferEventAction.REJECT: return Enum.Events.ActionLetter.reject
        case TransferEventAction.ABORT: return Enum.Events.ActionLetter.abort
        case TransferEventAction.BULK_COMMIT: return Enum.Events.ActionLetter.bulkCommit
        case TransferEventAction.BULK_ABORT: return Enum.Events.ActionLetter.bulkAbort
        default: return Enum.Events.ActionLetter.unknown
      }
    })()

    const functionality = (() => {
      switch (action) {
        case TransferEventAction.COMMIT:
        case TransferEventAction.RESERVE:
        case TransferEventAction.REJECT:
        case TransferEventAction.ABORT:
          return TransferEventType.NOTIFICATION
        case TransferEventAction.BULK_COMMIT:
        case TransferEventAction.BULK_ABORT:
          return TransferEventType.BULK_PROCESSING
        default: return Enum.Events.ActionLetter.unknown
      }
    })()

    // fulfil-specific declarations
    const isTransferError = action === TransferEventAction.ABORT
    const params = { message, kafkaTopic, decodedPayload: payload, span, consumer: Consumer, producer: Producer }

    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'getById' }))

    // We fail early and silently to allow timeout handler abort transfer
    // if 'RESERVED' transfer state is sent in with v1.0 content-type
    if (headers['content-type'].split('=')[1] === '1.0' && payload.transferState === TransferState.RESERVED) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `failSilentlyforReservedStateWith1.0ContentType--${actionLetter}0`))
      const errorMessage = 'action "RESERVE" is not allowed in fulfil handler for v1.0 clients.'
      Logger.isErrorEnabled && Logger.error(errorMessage)
      !!span && span.error(errorMessage)
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }

    const transfer = await TransferService.getById(transferId)
    const transferStateEnum = transfer && transfer.transferStateEnumeration

    // List of valid actions that Source & Destination headers should be checked
    const validActionsForRouteValidations = [
      TransferEventAction.COMMIT,
      TransferEventAction.RESERVE,
      TransferEventAction.REJECT,
      TransferEventAction.ABORT
    ]

    if (!transfer) {
      Logger.isErrorEnabled && Logger.error(Util.breadcrumb(location, `callbackInternalServerErrorNotFound--${actionLetter}1`))
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError('transfer not found')
      const eventDetail = { functionality, action: TransferEventAction.COMMIT }
      /**
       * TODO: BULK-Handle at BulkProcessingHandler (not in scope of #967)
       * HOWTO: The list of individual transfers being committed should contain
       * non-existing transferId
       */
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError

      // Lets validate FSPIOP Source & Destination Headers
    } else if (
      validActionsForRouteValidations.includes(action) && // Lets only check headers for specific actions that need checking (i.e. bulk should not since its already done elsewhere)
      (
        (headers[Enum.Http.Headers.FSPIOP.SOURCE] && (headers[Enum.Http.Headers.FSPIOP.SOURCE].toLowerCase() !== transfer.payeeFsp.toLowerCase())) ||
        (headers[Enum.Http.Headers.FSPIOP.DESTINATION] && (headers[Enum.Http.Headers.FSPIOP.DESTINATION].toLowerCase() !== transfer.payerFsp.toLowerCase()))
      )
    ) {
      /**
       * If fulfilment request is coming from a source not matching transfer payee fsp or destination not matching transfer payer fsp,
       */
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorSourceNotMatchingTransferFSPs--${actionLetter}2`))

      // Lets set a default non-matching error to fallback-on
      let fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'FSP does not match one of the fsp-id\'s associated with a transfer on the Fulfil callback response')

      // Lets make the error specific if the PayeeFSP IDs do not match
      if (headers[Enum.Http.Headers.FSPIOP.SOURCE].toLowerCase() !== transfer.payeeFsp.toLowerCase()) {
        fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `${Enum.Http.Headers.FSPIOP.SOURCE} does not match payee fsp on the Fulfil callback response`)
      }

      // Lets make the error specific if the PayerFSP IDs do not match
      if (headers[Enum.Http.Headers.FSPIOP.DESTINATION].toLowerCase() !== transfer.payerFsp.toLowerCase()) {
        fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `${Enum.Http.Headers.FSPIOP.DESTINATION} does not match payer fsp on the Fulfil callback response`)
      }

      const apiFSPIOPError = fspiopError.toApiErrorObject(Config.ERROR_HANDLING)

      // Set the event details to map to an ABORT_VALIDATION event targeted to the Position Handler
      const eventDetail = { functionality: TransferEventType.POSITION, action: TransferEventAction.ABORT_VALIDATION }

      // Lets handle the abort validation and change the transfer state to reflect this
      const transferAbortResult = await TransferService.handlePayeeResponse(transferId, payload, TransferEventAction.ABORT_VALIDATION, apiFSPIOPError)

      /**
       * TODO: BULK-Handle at BulkProcessingHandler (not in scope of #967)
       * HOWTO: For regular transfers, send the fulfil from non-payee dfsp.
       * Not sure if it will apply to bulk, as it could/should be captured
       * at BulkPrepareHander. To be verified as part of future story.
       */

      // Publish message to Position Handler
      // Key position abort with payer account id
      const payerAccount = await Participant.getAccountByNameAndCurrency(transfer.payerFsp, transfer.currency, Enum.Accounts.LedgerAccountType.POSITION)
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: apiFSPIOPError, eventDetail, fromSwitch, toDestination: transfer.payerFsp, messageKey: payerAccount.participantCurrencyId.toString() })

      /**
       * Send patch notification callback to original payee fsp if they asked for a a patch response.
       */
      if (action === TransferEventAction.RESERVE) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackReservedAborted--${actionLetter}3`))

        // Set the event details to map to an RESERVE_ABORTED event targeted to the Notification Handler
        const reserveAbortedEventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.RESERVED_ABORTED }

        // Extract error information
        const errorCode = apiFSPIOPError && apiFSPIOPError.errorInformation && apiFSPIOPError.errorInformation.errorCode
        const errorDescription = apiFSPIOPError && apiFSPIOPError.errorInformation && apiFSPIOPError.errorInformation.errorDescription

        // TODO: This should be handled by a PATCH /transfers/{id}/error callback in the future FSPIOP v1.2 specification, and instead we should just send the FSPIOP-Error instead! Ref: https://github.com/mojaloop/mojaloop-specification/issues/106.
        const reservedAbortedPayload = {
          transferId: transferAbortResult && transferAbortResult.id,
          completedTimestamp: transferAbortResult && transferAbortResult.completedTimestamp && (new Date(Date.parse(transferAbortResult.completedTimestamp))).toISOString(),
          transferState: TransferState.ABORTED,
          extensionList: { // lets add the extension list to handle the limitation of the FSPIOP v1.1 specification by adding the error cause...
            extension: [
              {
                key: 'cause',
                value: `${errorCode}: ${errorDescription}`
              }
            ]
          }
        }
        message.value.content.payload = reservedAbortedPayload
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail: reserveAbortedEventDetail, fromSwitch: true, toDestination: transfer.payeeFsp })
      }

      throw apiFSPIOPError
    }
    // If execution continues after this point we are sure transfer exists and source matches payee fsp

    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'dupCheck' }))
    const histTimerDuplicateCheckEnd = Metrics.getHistogram(
      'handler_transfers',
      'fulfil_duplicateCheckComparator - Metrics for transfer handler',
      ['success', 'funcName']
    ).startTimer()

    let dupCheckResult
    if (!isTransferError) {
      dupCheckResult = await Comparators.duplicateCheckComparator(transferId, payload, TransferService.getTransferFulfilmentDuplicateCheck, TransferService.saveTransferFulfilmentDuplicateCheck)
    } else {
      dupCheckResult = await Comparators.duplicateCheckComparator(transferId, payload, TransferService.getTransferErrorDuplicateCheck, TransferService.saveTransferErrorDuplicateCheck)
    }
    const { hasDuplicateId, hasDuplicateHash } = dupCheckResult
    histTimerDuplicateCheckEnd({ success: true, funcName: 'fulfil_duplicateCheckComparator' })
    if (hasDuplicateId && hasDuplicateHash) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, 'handleResend'))

      // This is a duplicate message for a transfer that is already in a finalized state
      // respond as if we received a GET /transfers/{ID} from the client
      if (transferStateEnum === TransferState.COMMITTED || transferStateEnum === TransferState.ABORTED) {
        message.value.content.payload = TransferObjectTransform.toFulfil(transfer)
        const eventDetail = { functionality, action }
        if (action !== TransferEventAction.RESERVE) {
          if (!isTransferError) {
            Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackFinalized2--${actionLetter}3`))
            eventDetail.action = TransferEventAction.FULFIL_DUPLICATE
            /**
             * HOWTO: During bulk fulfil use an individualTransfer from a previous bulk fulfil
             */
          } else {
            Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackFinalized3--${actionLetter}4`))
            eventDetail.action = TransferEventAction.ABORT_DUPLICATE
          }
        }
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }

      if (transferStateEnum === TransferState.RECEIVED || transferStateEnum === TransferState.RESERVED) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `inProgress2--${actionLetter}5`))
        /**
         * HOWTO: Nearly impossible to trigger for bulk - an individual transfer from a bulk needs to be triggered
         * for processing in order to have the fulfil duplicate hash recorded. While it is still in RESERVED state
         * the individual transfer needs to be requested by another bulk fulfil request!
         *
         * TODO: find a way to trigger this code branch and handle it at BulkProcessingHandler (not in scope of #967)
         */
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, histTimerEnd })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }

      // Error scenario - transfer.transferStateEnumeration is in some invalid state
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorInvalidTransferStateEnum--${actionLetter}6`))
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(
        `Invalid transferStateEnumeration:(${transferStateEnum}) for event action:(${action}) and type:(${type})`).toApiErrorObject(Config.ERROR_HANDLING)
      const eventDetail = { functionality, action: TransferEventAction.COMMIT }
      /**
       * HOWTO: Impossible to trigger for individual transfer in a bulk? (not in scope of #967)
       */
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError, eventDetail, fromSwitch })
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }

    // ERROR: We have seen a transfer of this ID before, but it's message hash doesn't match
    // the previous message hash.
    if (hasDuplicateId && !hasDuplicateHash) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST)
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorModified2--${actionLetter}7`))
      let action = TransferEventAction.FULFIL_DUPLICATE
      if (isTransferError) {
        action = TransferEventAction.ABORT_DUPLICATE
      }

      /**
       * HOWTO: During bulk fulfil use an individualTransfer from a previous bulk fulfil,
       * but use different fulfilment value.
       */
      const eventDetail = { functionality, action }
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError
    }

    // Transfer is not a duplicate, or message hasn't been changed.

    if (type !== TransferEventType.FULFIL) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorInvalidEventType--${actionLetter}15`))
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(`Invalid event type:(${type})`)
      const eventDetail = { functionality, action: TransferEventAction.COMMIT }
      /**
       * TODO: BulkProcessingHandler (not in scope of #967)
       */
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError
    }

    const validActions = [
      TransferEventAction.COMMIT,
      TransferEventAction.RESERVE,
      TransferEventAction.REJECT,
      TransferEventAction.ABORT,
      TransferEventAction.BULK_COMMIT,
      TransferEventAction.BULK_ABORT
    ]
    if (!validActions.includes(action)) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorInvalidEventAction--${actionLetter}15`))
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(`Invalid event action:(${action}) and/or type:(${type})`)
      const eventDetail = { functionality, action: TransferEventAction.COMMIT }
      /**
       * TODO: BulkProcessingHandler (not in scope of #967)
       */
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError
    }

    Util.breadcrumb(location, { path: 'validationCheck' })
    if (payload.fulfilment && !Validator.validateFulfilCondition(payload.fulfilment, transfer.condition)) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorInvalidFulfilment--${actionLetter}9`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'invalid fulfilment')
      const apiFSPIOPError = fspiopError.toApiErrorObject(Config.ERROR_HANDLING)
      await TransferService.handlePayeeResponse(transferId, payload, action, apiFSPIOPError)
      const eventDetail = { functionality: TransferEventType.POSITION, action: TransferEventAction.ABORT_VALIDATION }
      /**
       * TODO: BulkProcessingHandler (not in scope of #967) The individual transfer is ABORTED by notification is never sent.
       */
      // Key position validation abort with payer account id
      const payerAccount = await Participant.getAccountByNameAndCurrency(transfer.payerFsp, transfer.currency, Enum.Accounts.LedgerAccountType.POSITION)
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: apiFSPIOPError, eventDetail, messageKey: payerAccount.participantCurrencyId.toString() })

      // emit an extra message -  RESERVED_ABORTED if action === TransferEventAction.RESERVE
      if (action === TransferEventAction.RESERVE) {
        // Get the updated transfer now that completedTimestamp will be different
        // TODO: should we just modify TransferService.handlePayeeResponse to
        // return the completed timestamp? Or is it safer to go back to the DB here?
        const transferAbortResult = await TransferService.getById(transferId)
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackReservedAborted--${actionLetter}1`))
        const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.RESERVED_ABORTED }

        // Extract error information
        const errorCode = apiFSPIOPError && apiFSPIOPError.errorInformation && apiFSPIOPError.errorInformation.errorCode
        const errorDescription = apiFSPIOPError && apiFSPIOPError.errorInformation && apiFSPIOPError.errorInformation.errorDescription

        // TODO: This should be handled by a PATCH /transfers/{id}/error callback in the future FSPIOP v1.2 specification, and instead we should just send the FSPIOP-Error instead! Ref: https://github.com/mojaloop/mojaloop-specification/issues/106.
        const reservedAbortedPayload = {
          transferId: transferAbortResult && transferAbortResult.id,
          completedTimestamp: transferAbortResult && transferAbortResult.completedTimestamp && (new Date(Date.parse(transferAbortResult.completedTimestamp))).toISOString(),
          transferState: TransferState.ABORTED,
          extensionList: { // lets add the extension list to handle the limitation of the FSPIOP v1.1 specification by adding the error cause...
            extension: [
              {
                key: 'cause',
                value: `${errorCode}: ${errorDescription}`
              }
            ]
          }
        }
        message.value.content.payload = reservedAbortedPayload
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch: true, toDestination: transfer.payeeFsp })
      }
      throw fspiopError
    }

    if (transfer.transferState !== TransferState.RESERVED) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorNonReservedState--${actionLetter}10`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'non-RESERVED transfer state')
      const eventDetail = { functionality, action: TransferEventAction.COMMIT }
      /**
       * TODO: BulkProcessingHandler (not in scope of #967)
       */
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })

      // emit an extra message -  RESERVED_ABORTED if action === TransferEventAction.RESERVE
      if (action === TransferEventAction.RESERVE) {
        // Get the updated transfer now that completedTimestamp will be different
        // TODO: should we just modify TransferService.handlePayeeResponse to
        // return the completed timestamp? Or is it safer to go back to the DB here?
        const transferAborted = await TransferService.getById(transferId) // TODO: remove this once it can be tested
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackReservedAborted--${actionLetter}2`))
        const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.RESERVED_ABORTED }
        const reservedAbortedPayload = {
          transferId: transferAborted.id,
          completedTimestamp: Util.Time.getUTCString(new Date(transferAborted.completedTimestamp)), // TODO: remove this once it can be tested
          transferState: TransferState.ABORTED
        }
        message.value.content.payload = reservedAbortedPayload
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch: true, toDestination: transfer.payeeFsp })
      }
      throw fspiopError
    }

    if (transfer.expirationDate <= new Date(Util.Time.getUTCString(new Date()))) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorTransferExpired--${actionLetter}11`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED)
      const eventDetail = { functionality, action: TransferEventAction.COMMIT }
      /**
       * TODO: BulkProcessingHandler (not in scope of #967)
       */
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })

      // emit an extra message -  RESERVED_ABORTED if action === TransferEventAction.RESERVE
      if (action === TransferEventAction.RESERVE) {
        // Get the updated transfer now that completedTimestamp will be different
        // TODO: should we just modify TransferService.handlePayeeResponse to
        // return the completed timestamp? Or is it safer to go back to the DB here?
        const transferAborted = await TransferService.getById(transferId)
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackReservedAborted--${actionLetter}3`))
        const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.RESERVED_ABORTED }
        const reservedAbortedPayload = {
          transferId: transferAborted.id,
          completedTimestamp: Util.Time.getUTCString(new Date(transferAborted.completedTimestamp)),
          transferState: TransferState.ABORTED
        }
        message.value.content.payload = reservedAbortedPayload
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch: true })
      }
      throw fspiopError
    }

    // Validations Succeeded - process the fulfil
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'validationPassed' }))
    switch (action) {
      case TransferEventAction.COMMIT:
      case TransferEventAction.RESERVE:
      case TransferEventAction.BULK_COMMIT: {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `positionTopic2--${actionLetter}12`))
        await TransferService.handlePayeeResponse(transferId, payload, action)
        const eventDetail = { functionality: TransferEventType.POSITION, action }
        // Key position fulfil message with payee account id
        const payeeAccount = await Participant.getAccountByNameAndCurrency(transfer.payeeFsp, transfer.currency, Enum.Accounts.LedgerAccountType.POSITION)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, messageKey: payeeAccount.participantCurrencyId.toString() })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
      // TODO: why do we let this logic get this far? Why not remove it from validActions array above?
      case TransferEventAction.REJECT: {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `positionTopic3--${actionLetter}13`))
        const errorMessage = 'action REJECT is not allowed into fulfil handler'
        Logger.isErrorEnabled && Logger.error(errorMessage)
        !!span && span.error(errorMessage)
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
      // TODO: why do we let this logic get this far? Why not remove it from validActions array above?
      case TransferEventAction.ABORT:
      case TransferEventAction.BULK_ABORT:
      default: { // action === TransferEventAction.ABORT || action === TransferEventAction.BULK_ABORT // error-callback request to be processed
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `positionTopic4--${actionLetter}14`))
        let fspiopError
        const eInfo = payload.errorInformation
        try { // handle only valid errorCodes provided by the payee
          fspiopError = ErrorHandler.Factory.createFSPIOPErrorFromErrorInformation(eInfo)
        } catch (err) {
          /**
           * TODO: Handling of out-of-range errorCodes is to be introduced to the ml-api-adapter,
           * so that such requests are rejected right away, instead of aborting the transfer here.
           */
          Logger.isErrorEnabled && Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
          fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'API specification undefined errorCode')
          await TransferService.handlePayeeResponse(transferId, payload, action, fspiopError.toApiErrorObject(Config.ERROR_HANDLING))
          const eventDetail = { functionality: TransferEventType.POSITION, action }
          // Key position abort with payer account id
          const payerAccount = await Participant.getAccountByNameAndCurrency(transfer.payerFsp, transfer.currency, Enum.Accounts.LedgerAccountType.POSITION)
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, messageKey: payerAccount.participantCurrencyId.toString() })
          throw fspiopError
        }
        await TransferService.handlePayeeResponse(transferId, payload, action, fspiopError.toApiErrorObject(Config.ERROR_HANDLING))
        const eventDetail = { functionality: TransferEventType.POSITION, action }
        // Key position abort with payer account id
        const payerAccount = await Participant.getAccountByNameAndCurrency(transfer.payerFsp, transfer.currency, Enum.Accounts.LedgerAccountType.POSITION)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, messageKey: payerAccount.participantCurrencyId.toString() })
        // TODO(2556): I don't think we should emit an extra notification here
        // this is the case where the Payee sent an ABORT, so we don't need to tell them to abort
        throw fspiopError
      }
    }
  } catch (err) {
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
    Logger.isErrorEnabled && Logger.error(`${Util.breadcrumb(location)}::${err.message}--F0`)
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
  const location = { module: 'GetTransferHandler', method: '', path: '' }
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
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { method: `getTransfer:${action}` }))

    const actionLetter = Enum.Events.ActionLetter.get
    const params = { message, kafkaTopic, span, consumer: Consumer, producer: Producer }
    const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.GET }

    Util.breadcrumb(location, { path: 'validationFailed' })
    if (!await Validator.validateParticipantByName(message.value.from)) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `breakParticipantDoesntExist--${actionLetter}1`))
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, histTimerEnd })
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    const transfer = await TransferService.getByIdLight(transferId)
    if (!transfer) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorTransferNotFound--${actionLetter}3`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_ID_NOT_FOUND, 'Provided Transfer ID was not found on the server.')
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError
    }
    if (!await Validator.validateParticipantTransferId(message.value.from, transferId)) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorNotTransferParticipant--${actionLetter}2`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR)
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError
    }

    // ============================================================================================
    Util.breadcrumb(location, { path: 'validationPassed' })
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackMessage--${actionLetter}4`))
    message.value.content.payload = TransferObjectTransform.toFulfil(transfer)
    await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch })
    histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    return true
  } catch (err) {
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
    Logger.isErrorEnabled && Logger.error(`${Util.breadcrumb(location)}::${err.message}--G0`)
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
    Logger.isErrorEnabled && Logger.error(err)
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
    Logger.isErrorEnabled && Logger.error(err)
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
    Logger.isErrorEnabled && Logger.error(err)
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
    Logger.isErrorEnabled && Logger.error(err)
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
