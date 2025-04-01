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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

const EventSdk = require('@mojaloop/event-sdk')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Metrics = require('@mojaloop/central-services-metrics')
const { Enum, Util } = require('@mojaloop/central-services-shared')
const { Consumer, Producer } = require('@mojaloop/central-services-stream').Util

const { logger } = require('../../shared/logger')
const Config = require('../../lib/config')
const TransferObjectTransform = require('../../domain/transfer/transform')
const Participant = require('../../domain/participant')

const createRemittanceEntity = require('./createRemittanceEntity')
const Validator = require('./validator')
const dto = require('./dto')
const TransferService = require('../../domain/transfer/index')
const ProxyCache = require('../../lib/proxyCache')
const FxTransferService = require('../../domain/fx/index')

const { Kafka, Comparators } = Util
const { TransferState, TransferInternalState } = Enum.Transfers
const { Action, Type } = Enum.Events.Event
const { FSPIOPErrorCodes } = ErrorHandler.Enums
const { createFSPIOPError, reformatFSPIOPError } = ErrorHandler.Factory
const { fspId } = Config.INSTRUMENTATION_METRICS_LABELS

const rethrow = require('../../shared/rethrow')
const consumerCommit = true
const fromSwitch = true
const proxyEnabled = Config.PROXY_CACHE_CONFIG.enabled

const proceedForwardErrorMessage = async ({ fspiopError, isFx, params }) => {
  const eventDetail = {
    functionality: Type.NOTIFICATION,
    action: isFx ? Action.FX_FORWARDED : Action.FORWARDED
  }
  await Kafka.proceed(Config.KAFKA_CONFIG, params, {
    fspiopError,
    eventDetail,
    consumerCommit
  })
  logger.warn('proceedForwardErrorMessage is done', { fspiopError, eventDetail })
}

// think better name
const forwardPrepare = async ({ isFx, params, ID }) => {
  if (isFx) {
    const fxTransfer = await FxTransferService.getByIdLight(ID)
    if (!fxTransfer) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        FSPIOPErrorCodes.ID_NOT_FOUND,
        'Forwarded fxTransfer could not be found.'
      ).toApiErrorObject(Config.ERROR_HANDLING)
      // IMPORTANT: This singular message is taken by the ml-api-adapter and used to
      //            notify the payerFsp and proxy of the error.
      //            As long as the `to` and `from` message values are the fsp and fxp,
      //            and the action is `fx-forwarded`, the ml-api-adapter will notify both.
      await proceedForwardErrorMessage({ fspiopError, isFx, params })
      return true
    }

    if (fxTransfer.fxTransferState === TransferInternalState.RESERVED) {
      await FxTransferService.forwardedFxPrepare(ID)
    } else {
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(
        `Invalid State: ${fxTransfer.fxTransferState} - expected: ${TransferInternalState.RESERVED}`
      ).toApiErrorObject(Config.ERROR_HANDLING)
      // IMPORTANT: This singular message is taken by the ml-api-adapter and used to
      //            notify the payerFsp and proxy of the error.
      //            As long as the `to` and `from` message values are the fsp and fxp,
      //            and the action is `fx-forwarded`, the ml-api-adapter will notify both.
      await proceedForwardErrorMessage({ fspiopError, isFx, params })
    }
  } else {
    const transfer = await TransferService.getById(ID)
    if (!transfer) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        FSPIOPErrorCodes.ID_NOT_FOUND,
        'Forwarded transfer could not be found.'
      ).toApiErrorObject(Config.ERROR_HANDLING)
      // IMPORTANT: This singular message is taken by the ml-api-adapter and used to
      //            notify the payerFsp and proxy of the error.
      //            As long as the `to` and `from` message values are the payer and payee,
      //            and the action is `forwarded`, the ml-api-adapter will notify both.
      await proceedForwardErrorMessage({ fspiopError, isFx, params })
      return true
    }

    if (transfer.transferState === TransferInternalState.RESERVED) {
      await TransferService.forwardedPrepare(ID)
    } else {
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(
        `Invalid State: ${transfer.transferState} - expected: ${TransferInternalState.RESERVED}`
      ).toApiErrorObject(Config.ERROR_HANDLING)
      // IMPORTANT: This singular message is taken by the ml-api-adapter and used to
      //            notify the payerFsp and proxy of the error.
      //            As long as the `to` and `from` message values are the payer and payee,
      //            and the action is `forwarded`, the ml-api-adapter will notify both.
      await proceedForwardErrorMessage({ fspiopError, isFx, params })
    }
  }

  return true
}

/** @import { ProxyOrParticipant } from '#src/lib/proxyCache.js' */
/**
 * @typedef {Object} ProxyObligation
 * @property {boolean} isFx - Is FX transfer.
 * @property {Object} payloadClone - A clone of the original payload.
 * @property {ProxyOrParticipant} initiatingFspProxyOrParticipantId - initiating FSP: proxy or participant.
 * @property {ProxyOrParticipant} counterPartyFspProxyOrParticipantId - counterparty FSP: proxy or participant.
 * @property {boolean} isInitiatingFspProxy - initiatingFsp.(!inScheme && proxyId !== null).
 * @property {boolean} isCounterPartyFspProxy - counterPartyFsp.(!inScheme && proxyId !== null).
 */

/**
 * Calculates proxyObligation.
 * @returns {ProxyObligation} proxyObligation
 */
const calculateProxyObligation = async ({ payload, isFx, params, functionality, action }) => {
  const proxyObligation = {
    isFx,
    payloadClone: { ...payload },
    isInitiatingFspProxy: false,
    isCounterPartyFspProxy: false,
    initiatingFspProxyOrParticipantId: null,
    counterPartyFspProxyOrParticipantId: null
  }

  if (proxyEnabled) {
    const [initiatingFsp, counterPartyFsp] = isFx ? [payload.initiatingFsp, payload.counterPartyFsp] : [payload.payerFsp, payload.payeeFsp]

    // We need to double check the following validation logic incase of payee side currency conversion
    const payeeFspLookupOptions = isFx ? null : { validateCurrencyAccounts: true, accounts: [{ currency: payload.amount.currency, accountType: Enum.Accounts.LedgerAccountType.POSITION }] }

    ;[proxyObligation.initiatingFspProxyOrParticipantId, proxyObligation.counterPartyFspProxyOrParticipantId] = await Promise.all([
      ProxyCache.getFSPProxy(initiatingFsp),
      ProxyCache.getFSPProxy(counterPartyFsp, payeeFspLookupOptions)
    ])
    logger.debug('Prepare proxy cache lookup results', {
      initiatingFsp,
      counterPartyFsp,
      initiatingFspProxyOrParticipantId: proxyObligation.initiatingFspProxyOrParticipantId,
      counterPartyFspProxyOrParticipantId: proxyObligation.counterPartyFspProxyOrParticipantId
    })

    proxyObligation.isInitiatingFspProxy = !proxyObligation.initiatingFspProxyOrParticipantId.inScheme &&
      proxyObligation.initiatingFspProxyOrParticipantId.proxyId !== null
    proxyObligation.isCounterPartyFspProxy = !proxyObligation.counterPartyFspProxyOrParticipantId.inScheme &&
      proxyObligation.counterPartyFspProxyOrParticipantId.proxyId !== null

    if (isFx) {
      proxyObligation.payloadClone.initiatingFsp = !proxyObligation.initiatingFspProxyOrParticipantId?.inScheme &&
      proxyObligation.initiatingFspProxyOrParticipantId?.proxyId
        ? proxyObligation.initiatingFspProxyOrParticipantId.proxyId
        : payload.initiatingFsp
      proxyObligation.payloadClone.counterPartyFsp = !proxyObligation.counterPartyFspProxyOrParticipantId?.inScheme &&
      proxyObligation.counterPartyFspProxyOrParticipantId?.proxyId
        ? proxyObligation.counterPartyFspProxyOrParticipantId.proxyId
        : payload.counterPartyFsp
    } else {
      proxyObligation.payloadClone.payerFsp = !proxyObligation.initiatingFspProxyOrParticipantId?.inScheme &&
      proxyObligation.initiatingFspProxyOrParticipantId?.proxyId
        ? proxyObligation.initiatingFspProxyOrParticipantId.proxyId
        : payload.payerFsp
      proxyObligation.payloadClone.payeeFsp = !proxyObligation.counterPartyFspProxyOrParticipantId?.inScheme &&
      proxyObligation.counterPartyFspProxyOrParticipantId?.proxyId
        ? proxyObligation.counterPartyFspProxyOrParticipantId.proxyId
        : payload.payeeFsp
    }

    // If either debtor participant or creditor participant aren't in the scheme and have no proxy representative, then throw an error.
    if ((proxyObligation.initiatingFspProxyOrParticipantId.inScheme === false && proxyObligation.initiatingFspProxyOrParticipantId.proxyId === null) ||
      (proxyObligation.counterPartyFspProxyOrParticipantId.inScheme === false && proxyObligation.counterPartyFspProxyOrParticipantId.proxyId === null)) {
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND,
        `Payer proxy or payee proxy not found: initiatingFsp: ${initiatingFsp} counterPartyFsp: ${counterPartyFsp}`
      ).toApiErrorObject(Config.ERROR_HANDLING)
      await Kafka.proceed(Config.KAFKA_CONFIG, params, {
        consumerCommit,
        fspiopError,
        eventDetail: { functionality, action },
        fromSwitch,
        hubName: Config.HUB_NAME
      })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'calculateProxyObligation' })
    }
  }

  return proxyObligation
}

const checkDuplication = async ({ payload, isFx, ID, location }) => {
  const funcName = 'prepare_duplicateCheckComparator'
  const histTimerDuplicateCheckEnd = Metrics.getHistogram(
    'handler_transfers',
      `${funcName} - Metrics for transfer handler`,
      ['success', 'funcName']
  ).startTimer()

  const remittance = createRemittanceEntity(isFx)
  const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(
    ID,
    payload,
    remittance.getDuplicate,
    remittance.saveDuplicateHash
  )

  logger.info(Util.breadcrumb(location, { path: funcName }), { hasDuplicateId, hasDuplicateHash, isFx, ID })
  histTimerDuplicateCheckEnd({ success: true, funcName })

  return { hasDuplicateId, hasDuplicateHash }
}

const processDuplication = async ({
  duplication, isFx, ID, functionality, action, actionLetter, params, location
}) => {
  if (!duplication.hasDuplicateId) return

  let error
  if (!duplication.hasDuplicateHash) {
    logger.warn(Util.breadcrumb(location, `callbackErrorModified1--${actionLetter}5`))
    error = createFSPIOPError(FSPIOPErrorCodes.MODIFIED_REQUEST)
  } else if (action === Action.BULK_PREPARE) {
    logger.info(Util.breadcrumb(location, `validationError1--${actionLetter}2`))
    error = createFSPIOPError('Individual transfer prepare duplicate')
  }

  if (error) {
    await Kafka.proceed(Config.KAFKA_CONFIG, params, {
      consumerCommit,
      fspiopError: error.toApiErrorObject(Config.ERROR_HANDLING),
      eventDetail: { functionality, action },
      fromSwitch,
      hubName: Config.HUB_NAME
    })
    rethrow.rethrowAndCountFspiopError(error, { operation: 'processDuplication' })
  }
  logger.info(Util.breadcrumb(location, 'handleResend'))

  const transfer = await createRemittanceEntity(isFx)
    .getByIdLight(ID)

  const finalizedState = [TransferState.COMMITTED, TransferState.ABORTED, TransferState.RESERVED]
  const isFinalized =
    finalizedState.includes(transfer?.transferStateEnumeration) ||
    finalizedState.includes(transfer?.fxTransferStateEnumeration)
  const isPrepare = [Action.PREPARE, Action.FX_PREPARE, Action.FORWARDED, Action.FX_FORWARDED].includes(action)

  let eventDetail = { functionality, action: Action.PREPARE_DUPLICATE }
  if (isFinalized) {
    if (isPrepare) {
      logger.info(Util.breadcrumb(location, `finalized callback--${actionLetter}1`))
      params.message.value.content.payload = TransferObjectTransform.toFulfil(transfer, isFx)
      params.message.value.content.uriParams = { id: ID }
      const action = isFx ? Action.FX_PREPARE_DUPLICATE : Action.PREPARE_DUPLICATE
      eventDetail = { functionality, action }
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch, hubName: Config.HUB_NAME })
    } else if (action === Action.BULK_PREPARE) {
      logger.info(Util.breadcrumb(location, `validationError1--${actionLetter}2`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST, 'Individual transfer prepare duplicate')
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processDuplication' })
    }
  } else {
    logger.info(Util.breadcrumb(location, 'inProgress'))
    if (action === Action.BULK_PREPARE) {
      logger.info(Util.breadcrumb(location, `validationError2--${actionLetter}4`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST, 'Individual transfer prepare duplicate')
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'processDuplication' })
    } else { // action === TransferEventAction.PREPARE
      logger.info(Util.breadcrumb(location, `ignore--${actionLetter}3`))
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit })
      return true
    }
  }

  return true
}

const savePreparedRequest = async ({
  validationPassed,
  reasons,
  payload,
  isFx,
  functionality,
  params,
  location,
  determiningTransferCheckResult,
  proxyObligation
}) => {
  const logMessage = Util.breadcrumb(location, 'savePreparedRequest')
  try {
    logger.info(logMessage, { validationPassed, reasons })
    const reason = validationPassed ? null : reasons.toString()
    await createRemittanceEntity(isFx)
      .savePreparedRequest(
        payload,
        reason,
        validationPassed,
        determiningTransferCheckResult,
        proxyObligation
      )
  } catch (err) {
    logger.error(`${logMessage} error:`, err)
    const fspiopError = reformatFSPIOPError(err, FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
    await Kafka.proceed(Config.KAFKA_CONFIG, params, {
      consumerCommit,
      fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING),
      eventDetail: { functionality, action: Action.PREPARE },
      fromSwitch,
      hubName: Config.HUB_NAME
    })
    rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'savePreparedRequest' })
  }
}

const definePositionParticipant = async ({ isFx, payload, determiningTransferCheckResult, proxyObligation }) => {
  const cyrilResult = await createRemittanceEntity(isFx)
    .getPositionParticipant(payload, determiningTransferCheckResult, proxyObligation)

  let messageKey
  // On a proxied transfer prepare, if there is a corresponding fx transfer, `getPositionParticipant`
  // should return the fxp's proxy as the participantName since the fxp proxy would be saved as the counterPartyFsp
  // in the prior fx transfer prepare.
  // Following interscheme rules, if the debtor(fxTransfer FXP) and the creditor(transfer payee) are
  // represented by the same proxy, no position adjustment is needed.
  let isSameProxy = false
  // Only check transfers that have a related fxTransfer
  if (determiningTransferCheckResult?.watchListRecords?.length > 0) {
    const counterPartyParticipantFXPProxy = cyrilResult.participantName
    isSameProxy = counterPartyParticipantFXPProxy && proxyObligation?.counterPartyFspProxyOrParticipantId?.proxyId
      ? counterPartyParticipantFXPProxy === proxyObligation.counterPartyFspProxyOrParticipantId.proxyId
      : false
  }
  if (isSameProxy) {
    messageKey = '0'
  } else {
    const account = await Participant.getAccountByNameAndCurrency(
      cyrilResult.participantName,
      cyrilResult.currencyId,
      Enum.Accounts.LedgerAccountType.POSITION
    )
    messageKey = account.participantCurrencyId.toString()
  }
  logger.info('prepare positionParticipant details:', { messageKey, isSameProxy, cyrilResult })

  return {
    messageKey,
    cyrilResult
  }
}

const sendPositionPrepareMessage = async ({
  isFx,
  action,
  params,
  determiningTransferCheckResult,
  proxyObligation
}) => {
  const eventDetail = {
    functionality: Type.POSITION,
    action
  }

  const { messageKey, cyrilResult } = await definePositionParticipant({
    payload: proxyObligation.payloadClone,
    isFx,
    determiningTransferCheckResult,
    proxyObligation
  })

  params.message.value.content.context = {
    ...params.message.value.content.context,
    cyrilResult
  }
  // We route fx-prepare, bulk-prepare and prepare messages differently based on the topic configured for it.
  // Note: The batch handler does not currently support bulk-prepare messages, only prepare messages are supported.
  // And non batch processing is not supported for fx-prepare messages.
  // Therefore, it is necessary to check the action to determine the topic to route to.
  let topicNameOverride = Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.PREPARE
  if (action === Action.BULK_PREPARE) {
    topicNameOverride = Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.BULK_PREPARE
  } else if (action === Action.FX_PREPARE) {
    topicNameOverride = Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.FX_PREPARE
  }
  await Kafka.proceed(Config.KAFKA_CONFIG, params, {
    consumerCommit,
    eventDetail,
    messageKey,
    topicNameOverride,
    hubName: Config.HUB_NAME
  })

  return true
}

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
  const input = dto.prepareInputDto(error, messages)

  const histTimerEnd = Metrics.getHistogram(
    input.metric,
    `Consume a ${input.metric} message from the kafka topic and process it accordingly`,
    ['success', 'fspId']
  ).startTimer()
  if (error) {
    histTimerEnd({ success: false, fspId })
    rethrow.rethrowAndCountFspiopError(error, { operation: 'transferPrepare' })
  }

  const {
    message, payload, isFx, ID, headers, action, actionLetter, functionality, isForwarded
  } = input

  const contextFromMessage = EventSdk.Tracer.extractContextFromMessage(message.value)
  const span = EventSdk.Tracer.createChildSpanFromContext(`cl_${input.metric}`, contextFromMessage)

  try {
    span.setTags({ transactionId: ID })
    await span.audit(message, EventSdk.AuditEventAction.start)
    logger.info(Util.breadcrumb(location, { method: 'prepare' }))

    const params = {
      message,
      kafkaTopic: message.topic,
      decodedPayload: payload,
      span,
      consumer: Consumer,
      producer: Producer
    }

    if (proxyEnabled && isForwarded) {
      const isOk = await forwardPrepare({ isFx, params, ID })
      logger.info('forwardPrepare message is processed', { isOk, isFx, ID })
      return isOk
    }

    const proxyObligation = await calculateProxyObligation({
      payload, isFx, params, functionality, action
    })

    const duplication = await checkDuplication({ payload, isFx, ID, location })
    if (duplication.hasDuplicateId) {
      const success = await processDuplication({
        duplication, isFx, ID, functionality, action, actionLetter, params, location
      })
      histTimerEnd({ success, fspId })
      return success
    }

    const determiningTransferCheckResult = await createRemittanceEntity(isFx)
      .checkIfDeterminingTransferExists(proxyObligation.payloadClone, proxyObligation)

    const { validationPassed, reasons } = await Validator.validatePrepare(
      payload,
      headers,
      isFx,
      determiningTransferCheckResult,
      proxyObligation
    )

    await savePreparedRequest({
      validationPassed,
      reasons,
      payload,
      isFx,
      functionality,
      params,
      location,
      determiningTransferCheckResult,
      proxyObligation
    })

    if (!validationPassed) {
      logger.warn(Util.breadcrumb(location, { path: 'validationFailed' }))
      const fspiopError = createFSPIOPError(FSPIOPErrorCodes.VALIDATION_ERROR, reasons.toString())
      await createRemittanceEntity(isFx)
        .logTransferError(ID, FSPIOPErrorCodes.VALIDATION_ERROR.code, reasons.toString())
      /**
       * TODO: BULK-Handle at BulkProcessingHandler (not in scope of #967)
       * HOWTO: For regular transfers this branch may be triggered by sending
       * a transfer in a currency not supported by either dfsp. Not sure if it
       * will be triggered for bulk, because of the BulkPrepareHandler.
       */
      await Kafka.proceed(Config.KAFKA_CONFIG, params, {
        consumerCommit,
        fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING),
        eventDetail: { functionality, action },
        fromSwitch,
        hubName: Config.HUB_NAME
      })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'transferPrepare' })
    }

    logger.info(Util.breadcrumb(location, `positionTopic1--${actionLetter}7`))
    const success = await sendPositionPrepareMessage({
      isFx, action, params, determiningTransferCheckResult, proxyObligation
    })

    histTimerEnd({ success, fspId })
    return success
  } catch (err) {
    histTimerEnd({ success: false, fspId })
    const fspiopError = reformatFSPIOPError(err)
    logger.error(`${Util.breadcrumb(location)}::${err.message}`, err)
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

module.exports = {
  prepare,
  forwardPrepare,
  calculateProxyObligation,
  checkDuplication,
  processDuplication,
  savePreparedRequest,
  definePositionParticipant,
  sendPositionPrepareMessage
}
