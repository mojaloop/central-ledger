/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

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

const Logger = require('../../shared/logger').logger
const EventSdk = require('@mojaloop/event-sdk')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Metrics = require('@mojaloop/central-services-metrics')
const { Enum, Util } = require('@mojaloop/central-services-shared')
const { Consumer, Producer } = require('@mojaloop/central-services-stream').Util

const { logger } = require('../../shared/logger')
const { ERROR_MESSAGES } = require('../../shared/constants')
const Config = require('../../lib/config')
const TransferService = require('../../domain/transfer')
const FxService = require('../../domain/fx')
const FxTransferModel = require('../../models/fxTransfer')
const TransferObjectTransform = require('../../domain/transfer/transform')
const Participant = require('../../domain/participant')
const Validator = require('./validator')
const FxFulfilService = require('./FxFulfilService')

// particular handlers
const { prepare } = require('./prepare')

const { Kafka, Comparators } = Util
const TransferState = Enum.Transfers.TransferState
const TransferEventType = Enum.Events.Event.Type
const TransferEventAction = Enum.Events.Event.Action
const decodePayload = Util.StreamingProtocol.decodePayload

const rethrow = require('../../shared/rethrow')
const consumerCommit = true
const fromSwitch = true

const fulfil = async (error, messages) => {
  if (error) {
    rethrow.rethrowAndCountFspiopError(error, { operation: 'fulfil' })
  }
  let message
  if (Array.isArray(messages)) {
    message = messages[0]
  } else {
    message = messages
  }
  const contextFromMessage = EventSdk.Tracer.extractContextFromMessage(message.value)
  const span = EventSdk.Tracer.createChildSpanFromContext('cl_transfer_fulfil', contextFromMessage)
  try {
    await span.audit(message, EventSdk.AuditEventAction.start)
    const action = message.value.metadata.event.action

    const functionality = (() => {
      switch (action) {
        case TransferEventAction.COMMIT:
        case TransferEventAction.FX_COMMIT:
        case TransferEventAction.RESERVE:
        case TransferEventAction.FX_RESERVE:
        case TransferEventAction.REJECT:
        case TransferEventAction.FX_REJECT:
        case TransferEventAction.ABORT:
        case TransferEventAction.FX_ABORT:
          return TransferEventType.NOTIFICATION
        case TransferEventAction.BULK_COMMIT:
        case TransferEventAction.BULK_ABORT:
          return TransferEventType.BULK_PROCESSING
        default: return Enum.Events.ActionLetter.unknown
      }
    })()
    logger.info('FulfilHandler start:', { action, functionality })

    const fxActions = [
      TransferEventAction.FX_COMMIT,
      TransferEventAction.FX_RESERVE,
      TransferEventAction.FX_REJECT,
      TransferEventAction.FX_ABORT,
      TransferEventAction.FX_FORWARDED
    ]

    if (fxActions.includes(action)) {
      return await processFxFulfilMessage(message, functionality, span)
    } else {
      return await processFulfilMessage(message, functionality, span)
    }
  } catch (err) {
    logger.error(`error in FulfilHandler: ${err?.message}`, { err })
    const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
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

const processFulfilMessage = async (message, functionality, span) => {
  const location = { module: 'FulfilHandler', method: '', path: '' }
  const histTimerEnd = Metrics.getHistogram(
    'transfer_fulfil',
    'Consume a fulfil transfer message from the kafka topic and process it accordingly',
    ['success', 'fspId']
  ).startTimer()

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

  // We fail early and silently to allow timeout handler abort transfer
  // if 'RESERVED' transfer state is sent in with v1.0 content-type
  if (headers['content-type'].split('=')[1] === '1.0' && payload.transferState === TransferState.RESERVED) {
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `failSilentlyforReservedStateWith1.0ContentType--${actionLetter}0`))
    const errorMessage = 'action "RESERVE" is not allowed in fulfil handler for v1.0 clients.'
    Logger.isErrorEnabled && Logger.error(errorMessage)
    !!span && span.error(errorMessage)
    return true
  }

  // fulfil-specific declarations
  const isTransferError = action === TransferEventAction.ABORT
  const params = { message, kafkaTopic, decodedPayload: payload, span, consumer: Consumer, producer: Producer }

  Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'getById' }))

  const transfer = await TransferService.getById(transferId)
  const transferStateEnum = transfer?.transferStateEnumeration

  // List of valid actions for which source & destination headers are checked
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
    await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
    rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processFulfilMessage' })
  }

  // Lets validate FSPIOP Source & Destination Headers
  // We only check headers for specific actions that need checking (i.e. bulk should not be checked since it's already done elsewhere)
  // In interscheme scenario, we store proxy fsp id in transferParticipant table and hence we can't compare that data with fspiop headers in fulfil

  if (validActionsForRouteValidations.includes(action)) {
    // Ensure payerFsp and payeeFsp are not proxies and if they are, skip validating headers
    /**
     * If fulfilment request is coming from a source not matching transfer payee fsp or destination not matching transfer payer fsp,
     */
    if (
      (headers[Enum.Http.Headers.FSPIOP.SOURCE] && !transfer.payeeIsProxy && (headers[Enum.Http.Headers.FSPIOP.SOURCE].toLowerCase() !== transfer.payeeFsp.toLowerCase())) ||
      (headers[Enum.Http.Headers.FSPIOP.DESTINATION] && !transfer.payerIsProxy && (headers[Enum.Http.Headers.FSPIOP.DESTINATION].toLowerCase() !== transfer.payerFsp.toLowerCase()))
    ) {
      /**
       * If fulfilment request is coming from a source not matching transfer payee fsp or destination not matching transfer payer fsp,
       */
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorSourceNotMatchingTransferFSPs--${actionLetter}2`))

      // Lets set a default non-matching error to fallback-on
      let fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'FSP does not match one of the fsp-id\'s associated with a transfer on the Fulfil callback response')

      // Lets make the error specific if the PayeeFSP IDs do not match
      if (!transfer.payeeIsProxy && (headers[Enum.Http.Headers.FSPIOP.SOURCE].toLowerCase() !== transfer.payeeFsp.toLowerCase())) {
        fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `${Enum.Http.Headers.FSPIOP.SOURCE} does not match payee fsp on the Fulfil callback response`)
      }

      // Lets make the error specific if the PayerFSP IDs do not match
      if (!transfer.payerIsProxy && (headers[Enum.Http.Headers.FSPIOP.DESTINATION].toLowerCase() !== transfer.payerFsp.toLowerCase())) {
        fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `${Enum.Http.Headers.FSPIOP.DESTINATION} does not match payer fsp on the Fulfil callback response`)
      }

      const apiFSPIOPError = fspiopError.toApiErrorObject(Config.ERROR_HANDLING)

      // Lets handle the abort validation and change the transfer state to reflect this
      const transferAbortResult = await TransferService.handlePayeeResponse(transferId, payload, TransferEventAction.ABORT_VALIDATION, apiFSPIOPError)

      /**
       * TODO: BULK-Handle at BulkProcessingHandler (not in scope of #967)
       * HOWTO: For regular transfers, send the fulfil from non-payee dfsp.
       * Not sure if it will apply to bulk, as it could/should be captured
       * at BulkPrepareHander. To be verified as part of future story.
       */

      // Set the event details to map to an ABORT_VALIDATION event targeted to the Position Handler
      const eventDetail = {
        functionality: TransferEventType.POSITION,
        action: TransferEventAction.ABORT_VALIDATION
      }

      // Key position abort with payer account id
      const payerAccount = await Participant.getAccountByNameAndCurrency(transfer.payerFsp, transfer.currency, Enum.Accounts.LedgerAccountType.POSITION)

      // Publish message to Position Handler
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: apiFSPIOPError, eventDetail, fromSwitch, toDestination: transfer.payerFsp, messageKey: payerAccount.participantCurrencyId.toString(), hubName: Config.HUB_NAME })

      /**
       * Send patch notification callback to original payee fsp if they asked for a patch response.
       */
      if (action === TransferEventAction.RESERVE) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackReservedAborted--${actionLetter}3`))

        // Set the event details to map to an RESERVE_ABORTED event targeted to the Notification Handler
        const reserveAbortedEventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.RESERVED_ABORTED }

        // Extract error information
        const errorCode = apiFSPIOPError?.errorInformation?.errorCode
        const errorDescription = apiFSPIOPError?.errorInformation?.errorDescription

        // TODO: This should be handled by a PATCH /transfers/{id}/error callback in the future FSPIOP v1.2 specification, and instead we should just send the FSPIOP-Error instead!
        // Ref: https://github.com/mojaloop/mojaloop-specification/issues/106.
        const reservedAbortedPayload = {
          transferId: transferAbortResult?.id,
          completedTimestamp: transferAbortResult?.completedTimestamp && (new Date(Date.parse(transferAbortResult.completedTimestamp))).toISOString(),
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
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail: reserveAbortedEventDetail, fromSwitch: true, toDestination: transfer.payeeFsp, hubName: Config.HUB_NAME })
      }

      rethrow.rethrowAndCountFspiopError(apiFSPIOPError, { operation: 'processFulfilMessage' })
    }
  }

  // If execution continues after this point we are sure transfer exists and source matches payee fsp

  /**
   * Duplicate Check
   */
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
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch, hubName: Config.HUB_NAME })
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
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, histTimerEnd, hubName: Config.HUB_NAME })
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
    await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError, eventDetail, fromSwitch, hubName: Config.HUB_NAME })
    histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    return true
  }

  // ERROR: We have seen a transfer of this ID before, but it's message hash doesn't match
  // the previous message hash.
  if (hasDuplicateId && !hasDuplicateHash) {
    const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST)
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorModified2--${actionLetter}7`))
    const action = isTransferError ? TransferEventAction.ABORT_DUPLICATE : TransferEventAction.FULFIL_DUPLICATE

    /**
     * HOWTO: During bulk fulfil use an individualTransfer from a previous bulk fulfil,
     * but use different fulfilment value.
     */
    const eventDetail = { functionality, action }
    await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
    rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processFulfilMessage' })
  }

  // Transfer is not a duplicate, or message hasn't been changed.

  if (type !== TransferEventType.FULFIL) {
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorInvalidEventType--${actionLetter}15`))
    const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(`Invalid event type:(${type})`)
    const eventDetail = { functionality, action: TransferEventAction.COMMIT }
    /**
     * TODO: BulkProcessingHandler (not in scope of #967)
     */
    await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
    rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processFulfilMessage' })
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
    await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
    rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processFulfilMessage' })
  }

  Util.breadcrumb(location, { path: 'validationCheck' })
  if (payload.fulfilment && !Validator.validateFulfilCondition(payload.fulfilment, transfer.condition)) {
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorInvalidFulfilment--${actionLetter}9`))
    const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'invalid fulfilment')
    const apiFSPIOPError = fspiopError.toApiErrorObject(Config.ERROR_HANDLING)
    const updatedTransfer = await TransferService.handlePayeeResponse(transferId, payload, TransferEventAction.ABORT_VALIDATION, apiFSPIOPError)
    params.message.value.payload = {
      ...params.message.value.payload,
      completedTimestamp: updatedTransfer.completedTimestamp
    }
    const eventDetail = { functionality: TransferEventType.POSITION, action: TransferEventAction.ABORT_VALIDATION }
    /**
     * TODO: BulkProcessingHandler (not in scope of #967) The individual transfer is ABORTED by notification is never sent.
     */
    // Key position validation abort with payer account id

    const cyrilResult = await FxService.Cyril.processAbortMessage(transferId)

    params.message.value.content.context = {
      ...params.message.value.content.context,
      cyrilResult
    }
    if (cyrilResult.positionChanges.length > 0) {
      const participantCurrencyId = cyrilResult.positionChanges[0].participantCurrencyId
      await Kafka.proceed(
        Config.KAFKA_CONFIG,
        params,
        {
          consumerCommit,
          fspiopError: apiFSPIOPError,
          eventDetail,
          messageKey: participantCurrencyId.toString(),
          topicNameOverride: Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.ABORT,
          hubName: Config.HUB_NAME
        }
      )
    } else {
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError('Invalid cyril result')
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processFulfilMessage' })
    }

    // const payerAccount = await Participant.getAccountByNameAndCurrency(transfer.payerFsp, transfer.currency, Enum.Accounts.LedgerAccountType.POSITION)
    // await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: apiFSPIOPError, eventDetail, messageKey: payerAccount.participantCurrencyId.toString(), hubName: Config.HUB_NAME })

    // emit an extra message -  RESERVED_ABORTED if action === TransferEventAction.RESERVE
    if (action === TransferEventAction.RESERVE) {
      // Get the updated transfer now that completedTimestamp will be different
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
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch: true, toDestination: transfer.payeeFsp, hubName: Config.HUB_NAME })
    }
    rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processFulfilMessage' })
  }

  if (transfer.transferState !== Enum.Transfers.TransferInternalState.RESERVED &&
      transfer.transferState !== Enum.Transfers.TransferInternalState.RESERVED_FORWARDED
  ) {
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorNonReservedState--${actionLetter}10`))
    const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'non-RESERVED transfer state')
    const eventDetail = { functionality, action: TransferEventAction.COMMIT }
    /**
     * TODO: BulkProcessingHandler (not in scope of #967)
     */
    await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })

    // emit an extra message -  RESERVED_ABORTED if action === TransferEventAction.RESERVE
    if (action === TransferEventAction.RESERVE) {
      // Get the updated transfer now that completedTimestamp will be different
      const transferAborted = await TransferService.getById(transferId)
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackReservedAborted--${actionLetter}2`))
      const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.RESERVED_ABORTED }
      const reservedAbortedPayload = {
        transferId: transferAborted.id,
        completedTimestamp: Util.Time.getUTCString(new Date(transferAborted.completedTimestamp)), // TODO: remove this once it can be tested
        transferState: TransferState.ABORTED
      }
      message.value.content.payload = reservedAbortedPayload
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch: true, toDestination: transfer.payeeFsp, hubName: Config.HUB_NAME })
    }
    rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processFulfilMessage' })
  }

  // Check if the transfer has expired
  if (transfer.expirationDate <= new Date(Util.Time.getUTCString(new Date()))) {
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorTransferExpired--${actionLetter}11`))
    const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED)
    const eventDetail = { functionality, action: TransferEventAction.COMMIT }
    /**
     * TODO: BulkProcessingHandler (not in scope of #967)
     */
    await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })

    // emit an extra message -  RESERVED_ABORTED if action === TransferEventAction.RESERVE
    if (action === TransferEventAction.RESERVE) {
      // Get the updated transfer now that completedTimestamp will be different
      const transferAborted = await TransferService.getById(transferId)
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackReservedAborted--${actionLetter}3`))
      const eventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.RESERVED_ABORTED }
      const reservedAbortedPayload = {
        transferId: transferAborted.id,
        completedTimestamp: Util.Time.getUTCString(new Date(transferAborted.completedTimestamp)),
        transferState: TransferState.ABORTED
      }
      message.value.content.payload = reservedAbortedPayload
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch: true, hubName: Config.HUB_NAME })
    }
    rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processFulfilMessage' })
  }

  // Validations Succeeded - process the fulfil
  Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'validationPassed' }))
  switch (action) {
    case TransferEventAction.COMMIT:
    case TransferEventAction.RESERVE:
    case TransferEventAction.BULK_COMMIT: {
      let topicNameOverride
      if (action === TransferEventAction.COMMIT) {
        topicNameOverride = Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.COMMIT
      } else if (action === TransferEventAction.RESERVE) {
        topicNameOverride = Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.RESERVE
      } else if (action === TransferEventAction.BULK_COMMIT) {
        topicNameOverride = Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.BULK_COMMIT
      }

      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `positionTopic2--${actionLetter}12`))
      await TransferService.handlePayeeResponse(transferId, payload, action)
      const eventDetail = { functionality: TransferEventType.POSITION, action }
      const cyrilResult = await FxService.Cyril.processFulfilMessage(transferId, payload, transfer)
      if (cyrilResult.isFx) {
        params.message.value.content.context = {
          ...params.message.value.content.context,
          cyrilResult
        }
        if (cyrilResult.positionChanges.length > 0) {
          const participantCurrencyId = cyrilResult.positionChanges[0].participantCurrencyId
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, messageKey: participantCurrencyId.toString(), topicNameOverride, hubName: Config.HUB_NAME })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        } else {
          histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError('Invalid cyril result')
          rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processFulfilMessage' })
        }
      } else {
        // Key position fulfil message with payee account id
        const payeeAccount = await Participant.getAccountByNameAndCurrency(transfer.payeeFsp, transfer.currency, Enum.Accounts.LedgerAccountType.POSITION)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, messageKey: payeeAccount.participantCurrencyId.toString(), topicNameOverride, hubName: Config.HUB_NAME })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      }
      return true
    }
    case TransferEventAction.REJECT: {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `positionTopic3--${actionLetter}13`))
      const errorMessage = 'action REJECT is not allowed into fulfil handler'
      Logger.isErrorEnabled && Logger.error(errorMessage)
      !!span && span.error(errorMessage)
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    case TransferEventAction.BULK_ABORT: {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `positionTopic4--${actionLetter}14`))
      let fspiopError
      const eInfo = payload.errorInformation
      try { // handle only valid errorCodes provided by the payee
        fspiopError = ErrorHandler.Factory.createFSPIOPErrorFromErrorInformation(eInfo)
      } catch (err) {
        Logger.isErrorEnabled && Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
        fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'API specification undefined errorCode')
        await TransferService.handlePayeeResponse(transferId, payload, action, fspiopError.toApiErrorObject(Config.ERROR_HANDLING))
        const eventDetail = { functionality: TransferEventType.POSITION, action }
        // Key position abort with payer account id
        const payerAccount = await Participant.getAccountByNameAndCurrency(transfer.payerFsp, transfer.currency, Enum.Accounts.LedgerAccountType.POSITION)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, messageKey: payerAccount.participantCurrencyId.toString(), hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError)
      }
      await TransferService.handlePayeeResponse(transferId, payload, action, fspiopError.toApiErrorObject(Config.ERROR_HANDLING))
      const eventDetail = { functionality: TransferEventType.POSITION, action }
      // Key position abort with payer account id
      const payerAccount = await Participant.getAccountByNameAndCurrency(transfer.payerFsp, transfer.currency, Enum.Accounts.LedgerAccountType.POSITION)
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, messageKey: payerAccount.participantCurrencyId.toString(), hubName: Config.HUB_NAME })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processFulfilMessage' })
      break
    }
    case TransferEventAction.ABORT: {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `positionTopic4--${actionLetter}14`))
      let fspiopError
      const eInfo = payload.errorInformation
      try { // handle only valid errorCodes provided by the payee
        fspiopError = ErrorHandler.Factory.createFSPIOPErrorFromErrorInformation(eInfo)
      } catch (err) {
        Logger.isErrorEnabled && Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
        fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'API specification undefined errorCode')
        await TransferService.handlePayeeResponse(transferId, payload, action, fspiopError.toApiErrorObject(Config.ERROR_HANDLING))
        const eventDetail = { functionality: TransferEventType.POSITION, action }
        // Key position abort with payer account id
        const payerAccount = await Participant.getAccountByNameAndCurrency(transfer.payerFsp, transfer.currency, Enum.Accounts.LedgerAccountType.POSITION)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, messageKey: payerAccount.participantCurrencyId.toString(), hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processFulfilMessage' })
      }
      await TransferService.handlePayeeResponse(transferId, payload, action, fspiopError.toApiErrorObject(Config.ERROR_HANDLING))
      const eventDetail = { functionality: TransferEventType.POSITION, action }
      const cyrilResult = await FxService.Cyril.processAbortMessage(transferId)

      params.message.value.content.context = {
        ...params.message.value.content.context,
        cyrilResult
      }
      if (cyrilResult.positionChanges.length > 0) {
        const participantCurrencyId = cyrilResult.positionChanges[0].participantCurrencyId
        await Kafka.proceed(
          Config.KAFKA_CONFIG,
          params,
          {
            consumerCommit,
            fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING),
            eventDetail,
            messageKey: participantCurrencyId.toString(),
            topicNameOverride: Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.ABORT,
            hubName: Config.HUB_NAME
          }
        )
      } else {
        const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError('Invalid cyril result')
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processFulfilMessage' })
      }
    }
  }
}

const processFxFulfilMessage = async (message, functionality, span) => {
  const histTimerEnd = Metrics.getHistogram(
    'fx_transfer_fulfil',
    'Consume a fx fulfil transfer message from the kafka topic and process it accordingly',
    ['success', 'fspId']
  ).startTimer()

  const {
    payload,
    headers,
    type,
    action,
    commitRequestId,
    kafkaTopic
  } = FxFulfilService.decodeKafkaMessage(message)

  const log = logger.child({ commitRequestId, type, action })
  log.info('processFxFulfilMessage start...', { payload })

  const params = {
    message,
    kafkaTopic,
    span,
    decodedPayload: payload,
    consumer: Consumer,
    producer: Producer
  }

  const fxFulfilService = new FxFulfilService({
    log, Config, Comparators, Validator, FxTransferModel, Kafka, params
  })

  // Validate event type
  await fxFulfilService.validateEventType(type, functionality)

  // Validate action
  const validActions = [
    TransferEventAction.FX_RESERVE,
    TransferEventAction.FX_COMMIT,
    // TransferEventAction.FX_REJECT,
    TransferEventAction.FX_ABORT,
    TransferEventAction.FX_FORWARDED
  ]
  if (!validActions.includes(action)) {
    const errorMessage = ERROR_MESSAGES.fxActionIsNotAllowed(action)
    log.error(errorMessage)
    span?.error(errorMessage)
    histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    return true
  }

  const transfer = await fxFulfilService.getFxTransferDetails(commitRequestId, functionality)
  await fxFulfilService.validateHeaders({ transfer, headers, payload })

  // If execution continues after this point we are sure fxTransfer exists and source matches payee fsp
  const histTimerDuplicateCheckEnd = Metrics.getHistogram(
    'fx_handler_transfers',
    'fxFulfil_duplicateCheckComparator - Metrics for fxTransfer handler',
    ['success', 'funcName']
  ).startTimer()

  const dupCheckResult = await fxFulfilService.getDuplicateCheckResult({ commitRequestId, payload, action })
  histTimerDuplicateCheckEnd({ success: true, funcName: 'fxFulfil_duplicateCheckComparator' })

  const isDuplicate = await fxFulfilService.checkDuplication({ dupCheckResult, transfer, functionality, action, type })
  if (isDuplicate) {
    log.info('fxTransfer duplication detected, skip further processing')
    histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    return true
  }

  // Transfer is not a duplicate, or message hasn't been changed.

  payload.fulfilment && await fxFulfilService.validateFulfilment(transfer, payload)
  await fxFulfilService.validateTransferState(transfer, functionality)
  await fxFulfilService.validateExpirationDate(transfer, functionality)

  log.info('Validations Succeeded - process the fxFulfil...')

  switch (action) {
    case TransferEventAction.FX_RESERVE:
    case TransferEventAction.FX_COMMIT: {
      const success = await fxFulfilService.processFxFulfil({ transfer, payload, action })
      log.info('fxFulfil handling is done', { success })
      histTimerEnd({ success, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return success
    }
    case TransferEventAction.FX_ABORT: {
      const success = await fxFulfilService.processFxAbort({ transfer, payload, action })
      log.info('fxAbort handling is done', { success })
      histTimerEnd({ success, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
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
    rethrow.rethrowAndCountFspiopError(error, { operation: 'getTransfer' })
  }
  let message = {}
  if (Array.isArray(messages)) {
    message = messages[0]
  } else {
    message = messages
  }
  const action = message.value.metadata.event.action
  const isFx = action === TransferEventAction.FX_GET
  const contextFromMessage = EventSdk.Tracer.extractContextFromMessage(message.value)
  const span = EventSdk.Tracer.createChildSpanFromContext('cl_transfer_get', contextFromMessage)
  try {
    await span.audit(message, EventSdk.AuditEventAction.start)
    const metadata = message.value.metadata
    const action = metadata.event.action
    const transferIdOrCommitRequestId = message.value.content.uriParams.id
    const kafkaTopic = message.topic
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { method: `getTransfer:${action}` }))

    const actionLetter = Enum.Events.ActionLetter.get
    const params = { message, kafkaTopic, span, consumer: Consumer, producer: Producer }
    const eventDetail = { functionality: TransferEventType.NOTIFICATION, action }

    Util.breadcrumb(location, { path: 'validationFailed' })
    if (!await Validator.validateParticipantByName(message.value.from)) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `breakParticipantDoesntExist--${actionLetter}1`))
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, histTimerEnd, hubName: Config.HUB_NAME })
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    if (isFx) {
      const fxTransfer = await FxTransferModel.fxTransfer.getByIdLight(transferIdOrCommitRequestId)
      if (!fxTransfer) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorTransferNotFound--${actionLetter}3`))
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_ID_NOT_FOUND, 'Provided commitRequest ID was not found on the server.')
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'getTransfer' })
      }
      if (!await Validator.validateParticipantForCommitRequestId(message.value.from, transferIdOrCommitRequestId)) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorNotFxTransferParticipant--${actionLetter}2`))
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'getTransfer' })
      }
      Util.breadcrumb(location, { path: 'validationPassed' })
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackMessage--${actionLetter}4`))
      message.value.content.payload = TransferObjectTransform.toFulfil(fxTransfer, true)
    } else {
      const transfer = await TransferService.getByIdLight(transferIdOrCommitRequestId)
      if (!transfer) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorTransferNotFound--${actionLetter}3`))
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_ID_NOT_FOUND, 'Provided Transfer ID was not found on the server.')
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'getTransfer' })
      }
      if (!await Validator.validateParticipantTransferId(message.value.from, transferIdOrCommitRequestId)) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorNotTransferParticipant--${actionLetter}2`))
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'getTransfer' })
      }
      Util.breadcrumb(location, { path: 'validationPassed' })
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackMessage--${actionLetter}4`))
      message.value.content.payload = TransferObjectTransform.toFulfil(transfer)
    }

    await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch, hubName: Config.HUB_NAME })
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
    const { TRANSFER } = TransferEventType
    const { PREPARE } = TransferEventAction

    const topicName = Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, TRANSFER, PREPARE)
    const consumeConfig = Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, TRANSFER.toUpperCase(), PREPARE.toUpperCase())
    consumeConfig.rdkafkaConf['client.id'] = topicName

    await Consumer.createHandler(topicName, consumeConfig, prepare)
    return true
  } catch (err) {
    rethrow.rethrowAndCountFspiopError(err, { operation: 'registerPrepareHandler' })
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
    rethrow.rethrowAndCountFspiopError(err, { operation: 'registerFulfilHandler' })
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
    rethrow.rethrowAndCountFspiopError(err, { operation: 'registerGetTransferHandler' })
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
    rethrow.rethrowAndCountFspiopError(err, { operation: 'registerAllHandlers' })
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
