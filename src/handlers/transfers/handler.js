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
const FulfilService = require('./FulfilService')
const TransferErrorModel = require('../../models/transfer/transferError')
const FxTransferErrorModel = require('../../models/fxTransfer/fxTransferError')
// particular handlers
const { prepare } = require('./prepare')

const { Kafka, Comparators } = Util
const TransferState = Enum.Transfers.TransferState
const TransferEventType = Enum.Events.Event.Type
const TransferEventAction = Enum.Events.Event.Action
const decodePayload = Util.StreamingProtocol.decodePayload

const rethrow = require('../../shared/rethrow')
const externalParticipantCached = require('../../models/participant/externalParticipantCached')
const facade = require('../../models/participant/facade')
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

  const log = logger.child({ transferId, type, action })
  log.debug('processFulfilMessage start...')

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
  const params = { message, kafkaTopic, decodedPayload: payload, span, consumer: Consumer, producer: Producer }

  const fulfilService = new FulfilService({
    log,
    Config,
    Comparators,
    Validator,
    TransferService,
    FxService,
    Participant,
    Kafka,
    params
  })

  // Validate event type and action early
  await fulfilService.validateEventType(type, functionality)
  await fulfilService.validateAction(action, functionality)

  Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'getById' }))

  const transfer = await fulfilService.getTransferDetails(transferId, functionality)

  // List of valid actions for which source & destination headers are checked
  const validActionsForRouteValidations = [
    TransferEventAction.COMMIT,
    TransferEventAction.RESERVE,
    TransferEventAction.REJECT,
    TransferEventAction.ABORT
  ]

  // Validate FSPIOP Source & Destination Headers using FulfilService
  await fulfilService.validateHeaders({
    transfer,
    headers,
    payload,
    action,
    validActionsForRouteValidations
  })

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

  const dupCheckResult = await fulfilService.getDuplicateCheckResult({ transferId, payload, action })
  histTimerDuplicateCheckEnd({ success: true, funcName: 'fulfil_duplicateCheckComparator' })

  const isDuplicate = await fulfilService.checkDuplication({
    dupCheckResult,
    transfer,
    functionality,
    action,
    type
  })
  if (isDuplicate) {
    log.info('Transfer duplication detected, skip further processing')
    histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    return true
  }
  Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'dupCheckPassed' }))

  // Transfer is not a duplicate, or message hasn't been changed.

  // Validate expiration date using FulfilService
  await fulfilService.validateExpirationDate(transfer, functionality, action)

  // Validate fulfilment condition using FulfilService
  await fulfilService.validateFulfilment(transfer, payload, action)

  // This ensures only valid state transitions are allowed before any processing
  await fulfilService.validateTransferState(transfer, functionality, action)

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
      return true
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

    // When the GET is triggered in a interscheme timeout scenario the source will be
    // the hub participant. Since they are not considered an external participant, we need to
    // check the presence of the proxy header to determine if this is a proxied GET from an hub
    const proxy = message.value.content.headers?.[Enum.Http.Headers.FSPIOP.PROXY]
    const isProxiedGet = proxy ? true : null

    if (!isProxiedGet && !await Validator.validateParticipantByName(message.value.from)) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `breakParticipantDoesntExist--${actionLetter}1`))
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, histTimerEnd, hubName: Config.HUB_NAME })
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }

    // Check if destination is an external participant
    const destination = message.value.content.headers?.[Enum.Http.Headers.FSPIOP.DESTINATION]
    const isExternalParticipant = destination ? await externalParticipantCached.getByName(destination) : null

    if (isFx) {
      let fxTransfer
      if (isProxiedGet) {
        fxTransfer = await FxTransferModel.fxTransfer.getAllDetailsByCommitRequestId(transferIdOrCommitRequestId)
      } else {
        fxTransfer = await FxTransferModel.fxTransfer.getByIdLight(transferIdOrCommitRequestId)
      }

      // If scheme has no record of the fxTransfer, return error 3208 before any other check.
      // This is an edge case where data loss might have occurred in the upstream scheme,
      // and the downstream hub is trying to retrieve the fxTransfer details in order to
      // release reserved positions.
      if (!fxTransfer) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorTransferNotFound--${actionLetter}3`))

        // If this is a proxied GET, add the source hub as an external participant so we can direct the callback to that hub
        if (isProxiedGet && proxy) {
          await facade.getExternalParticipantIdByNameOrCreate({ name: message.value.from, proxyId: proxy })
        }

        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_ID_NOT_FOUND, 'Provided commitRequest ID was not found on the server.')
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'getTransfer' })
      }

      // Interscheme gets are only allowed to be triggered by hubs.
      // Assumption is that proxy headers will have logic outside of central-ledger to ensure they are
      // only added passing through a proxy and can not be added by a participant directly.
      // This code only executes in a regional scheme between two buffer schemes.

      // Each hub will only ask the adjacent scheme for the transfer details.
      // If the regional scheme also has the transfer in a RESERVED_FORWARDED state then do nothing
      // The self heal in the regional scheme will resolve the RESERVED_FORWARDED state
      // and then the initiating buffer hub will be able to retrieve the transfer details successfully in the next retry,
      // which will trigger the correct notification callback to resolve the RESERVED_FORWARDED state in the initiating buffer hub's scheme.
      if (isProxiedGet && isExternalParticipant && fxTransfer && fxTransfer.transferState === Enum.Transfers.TransferInternalState.RESERVED_FORWARDED) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `regionalSchemeGetForFxReservedForwarded--${actionLetter}4`))
        // Do nothing
        return true
      }

      // Check if fxTransfer state is not COMMITTED/RESERVED/SETTLED
      const replyWithPutErrorCallback = fxTransfer.transferStateEnumeration !== TransferState.COMMITTED &&
        fxTransfer.transferStateEnumeration !== TransferState.RESERVED &&
        fxTransfer.transferStateEnumeration !== TransferState.SETTLED

      // Special scenario for interscheme fxTransfers where we need to reply with the original error callback
      // in order to resolve RESERVED_FORWARDED fxTransfers in other regional/buffer schemes.
      // i.e Will trigger an interscheme PUT /fxTransfers/{id}/error callback to
      // inform the original initiating fsp of the error that caused the fxTransfer to not
      // be in a COMMITTED/RESERVED/SETTLED state, so that the external hub can
      // resolve the RESERVED_FORWARDED state in their scheme.
      if (isProxiedGet && replyWithPutErrorCallback) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `getRequestOnFailedInterschemeFxTransfer--${actionLetter}5`))
        // Get the fxTransfer error details
        const fxTransferError = await FxTransferErrorModel.getByCommitRequestId(transferIdOrCommitRequestId)
        if (fxTransferError) {
          Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `getRequestOnFailedInterschemeFxTransfer--${actionLetter}6`))
          // Action choice tells notification handler what to do.
          // In this case inform payer.
          const errorEventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.FX_TIMEOUT_RECEIVED }

          const errorPayload = {
            errorInformation: {
              errorCode: fxTransferError.errorCode,
              errorDescription: fxTransferError.errorDescription
            }
          }
          if (!message.value.content.uriParams || !message.value.content.uriParams.id) {
            message.value.content.uriParams = { id: transferIdOrCommitRequestId }
          }
          await Kafka.proceed(
            Config.KAFKA_CONFIG,
            params, {
              consumerCommit,
              fspiopError: errorPayload,
              eventDetail: errorEventDetail,
              fromSwitch,
              hubName: Config.HUB_NAME,
              toDestination: fxTransfer.externalInitiatingFspName
            })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          return true
        }
      }

      // Ignore validation for proxied GETs since they are triggered by the hub and not an external participant,
      // so the hub might be trying to retrieve fxTransfer details for a fxTransfer they are not a party of in order
      // to trigger the correct notification callback to resolve a RESERVED_FORWARDED state in another scheme.
      if (!isProxiedGet && !await Validator.validateParticipantForCommitRequestId(message.value.from, transferIdOrCommitRequestId)) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorNotFxTransferParticipant--${actionLetter}2`))
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'getTransfer' })
      }

      // If execution continues after this point we are sure that either this
      // is not a proxied GET or it is a proxied GET that an external hub is asking
      // for a status update, so we can proceed with retrieving
      // the fxTransfer details and returning them in the payload.
      // i.e Will trigger a PUT /fxTransfers/{id} callback to inform the original
      // payer of the transfer details or a external hub of the transfer details in order to resolve a RESERVED_FORWARDED state in another scheme.
      Util.breadcrumb(location, { path: 'validationPassed' })
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackMessage--${actionLetter}4`))
      message.value.content.payload = TransferObjectTransform.toFulfil(fxTransfer, true)

      if (isProxiedGet) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `getRequestOnInterschemePassedFxTransfer--${actionLetter}7`))
        await Kafka.proceed(
          Config.KAFKA_CONFIG,
          params,
          {
            consumerCommit,
            eventDetail,
            fromSwitch,
            hubName: Config.HUB_NAME,
            // Hubs trigger interscheme GETs, but the transfer details need to be sent to the original payer
            // which can be found as the external initiating FSP in the fxTransfer details.
            toDestination: fxTransfer.externalInitiatingFspName
          })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
    } else {
      let transfer
      if (isProxiedGet) {
        transfer = await TransferService.getById(transferIdOrCommitRequestId)
      } else {
        transfer = await TransferService.getByIdLight(transferIdOrCommitRequestId)
      }

      // If scheme has no record of the transfer, return error 3208 before any other check.
      // This is an edge case where data loss might have occurred in the upstream scheme,
      // and the downstream hub is trying to retrieve the transfer details in order to
      // release reserved positions.
      if (!transfer) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorTransferNotFound--${actionLetter}3`))

        // If this is a proxied GET, add the source hub as an external participant so we can direct the callback to that hub
        if (isProxiedGet && proxy) {
          await facade.getExternalParticipantIdByNameOrCreate({ name: message.value.from, proxyId: proxy })
        }

        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_ID_NOT_FOUND, 'Provided Transfer ID was not found on the server.')
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'getTransfer' })
      }

      // Interscheme gets are only allowed to be triggered by hubs.
      // Assumption is that proxy headers will have logic outside of central-ledger to ensure they are
      // only added passing through a proxy and can not be added by a participant directly.
      // This code only executes in a regional scheme between two buffer schemes.

      // Each hub will only ask the adjacent scheme for the transfer details.
      // If the regional scheme also has the transfer in a RESERVED_FORWARDED state then do nothing
      // The self heal in the regional scheme will resolve the RESERVED_FORWARDED state
      // and then the initiating buffer hub will be able to retrieve the transfer details successfully in the next retry,
      // which will trigger the correct notification callback to resolve the RESERVED_FORWARDED state in the initiating buffer hub's scheme.
      if (isProxiedGet && isExternalParticipant && transfer && transfer.transferState === Enum.Transfers.TransferInternalState.RESERVED_FORWARDED) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `regionalSchemeGetForReservedForwarded--${actionLetter}4`))
        // Do nothing
        return true
      }

      // Check if transfer state is not COMMITTED/RESERVED/SETTLED
      const replyWithPutErrorCallback = transfer.transferStateEnumeration !== TransferState.COMMITTED &&
        transfer.transferStateEnumeration !== TransferState.RESERVED &&
        transfer.transferStateEnumeration !== TransferState.SETTLED

      // Special scenario for interscheme transfers where we need to reply with the original error callback
      // in order to resolve RESERVED_FORWARDED transfers in other regional/buffer schemes.
      // i.e Will trigger an interscheme PUT /transfers/{id}/error callback to
      // inform the original payer of the error that caused the transfer to not
      // be in a COMMITTED/RESERVED/SETTLED state, so that the external hub can
      // resolve the RESERVED_FORWARDED state in their scheme.
      if (isProxiedGet && replyWithPutErrorCallback) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `getRequestOnFailedInterschemeTransfer--${actionLetter}5`))
        const transferError = await TransferErrorModel.getByTransferId(transferIdOrCommitRequestId)
        if (transferError) {
          Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `getRequestOnFailedInterschemeTransfer--${actionLetter}6`))
          // Action choice tells notification handler what to do.
          // In this case inform payer.
          const errorEventDetail = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.TIMEOUT_RECEIVED }

          // Construct the transfer error payload from the stored error details
          const errorPayload = {
            errorInformation: {
              errorCode: transferError.errorCode,
              errorDescription: transferError.errorDescription
            }
          }
          if (!message.value.content.uriParams || !message.value.content.uriParams.id) {
            message.value.content.uriParams = { id: transferIdOrCommitRequestId }
          }
          await Kafka.proceed(
            Config.KAFKA_CONFIG,
            params,
            {
              consumerCommit,
              fspiopError: errorPayload,
              eventDetail: errorEventDetail,
              fromSwitch,
              hubName: Config.HUB_NAME,
              // Hubs trigger interscheme GETs, but the fulfil error needs to be sent to the original payer
              // which can be found as the external payer in the transfer details.
              toDestination: transfer.externalPayerName
            })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          return true
        }
      }

      // Ignore validation for proxied GETs since they are triggered by an external hub trying to retrieve transfer
      // details for a transfer they are not a party of in order
      // to trigger the correct notification callback to resolve a RESERVED_FORWARDED state in another scheme.
      if (!isProxiedGet && !await Validator.validateParticipantTransferId(message.value.from, transferIdOrCommitRequestId)) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorNotTransferParticipant--${actionLetter}2`))
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'getTransfer' })
      }

      // If execution continues after this point we are sure that either this
      // is not a proxied GET or it is a proxied GET that an external hub is asking
      // for a status update, so we can proceed with retrieving
      // the transfer details and returning them in the payload.
      // i.e Will trigger a PUT /transfers/{id} callback to inform the original
      // payer of the transfer details or a external hub of the transfer details in order to resolve a RESERVED_FORWARDED state in another scheme.
      Util.breadcrumb(location, { path: 'validationPassed' })
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackMessage--${actionLetter}4`))
      message.value.content.payload = TransferObjectTransform.toFulfil(transfer)

      if (isProxiedGet) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `getRequestOnInterschemePassedTransfer--${actionLetter}7`))
        await Kafka.proceed(
          Config.KAFKA_CONFIG,
          params,
          {
            consumerCommit,
            eventDetail,
            fromSwitch,
            hubName: Config.HUB_NAME,
            // Hubs trigger interscheme GETs, but the transfer details need to be sent to the original payer
            // which can be found as the external payer in the transfer details.
            toDestination: transfer.externalPayerName
          })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
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
