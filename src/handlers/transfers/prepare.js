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
const TransferService = require('#src/domain/transfer/index')
const ProxyCache = require('#src/lib/proxyCache')

const { Kafka, Comparators } = Util
const { TransferState } = Enum.Transfers
const { Action, Type } = Enum.Events.Event
const { FSPIOPErrorCodes } = ErrorHandler.Enums
const { createFSPIOPError, reformatFSPIOPError } = ErrorHandler.Factory
const { fspId } = Config.INSTRUMENTATION_METRICS_LABELS

const consumerCommit = true
const fromSwitch = true
const proxyEnabled = Config.PROXY_CACHE_CONFIG.enabled

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
    logger.error(Util.breadcrumb(location, `callbackErrorModified1--${actionLetter}5`))
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
    throw error
  }
  logger.info(Util.breadcrumb(location, 'handleResend'))

  const transfer = await createRemittanceEntity(isFx)
    .getByIdLight(ID)

  const isFinalized = [TransferState.COMMITTED, TransferState.ABORTED].includes(transfer?.transferStateEnumeration)
  const isPrepare = [Action.PREPARE, Action.FX_PREPARE, Action.FORWARDED].includes(action)

  if (isFinalized && isPrepare) {
    logger.info(Util.breadcrumb(location, `finalized callback--${actionLetter}1`))
    params.message.value.content.payload = TransferObjectTransform.toFulfil(transfer, isFx)
    params.message.value.content.uriParams = { id: ID }
    const eventDetail = { functionality, action: Action.PREPARE_DUPLICATE }
    await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch, hubName: Config.HUB_NAME })
  } else {
    logger.info(Util.breadcrumb(location, `ignore--${actionLetter}3`))
    await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, hubName: Config.HUB_NAME })
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
    logger.error(`${logMessage} error - ${err.message}`)
    const fspiopError = reformatFSPIOPError(err, FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
    await Kafka.proceed(Config.KAFKA_CONFIG, params, {
      consumerCommit,
      fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING),
      eventDetail: { functionality, action: Action.PREPARE },
      fromSwitch,
      hubName: Config.HUB_NAME
    })
    throw fspiopError
  }
}

const definePositionParticipant = async ({ isFx, payload, determiningTransferCheckResult, proxyObligation }) => {
  const cyrilResult = await createRemittanceEntity(isFx)
    .getPositionParticipant(payload, determiningTransferCheckResult, proxyObligation.isCreditorProxy)
  let messageKey
  /**
   * Interscheme accounting rules:
   *  - If the participant has a proxy representation, the proxy's account should be used for the position change.
   *  - If the debtor and the creditor DFSPs are represented by the same proxy, no position adjustment is needed.
   */
  // On a proxied transfer prepare if there is a corresponding fx transfer `getPositionParticipant`
  // should return the fxp's proxy as the participantName since the fxp proxy would be saved as the counterpartyFsp
  // in the prior fx transfer prepare.
  // TODO: This ideally should compare the proxy's participantCurrency accounts to avoid some edge cases.
  const counterPartyParticipantFXPProxy = cyrilResult.participantName
  const isSameProxy = counterPartyParticipantFXPProxy && proxyObligation?.creditorProxyOrParticipantId?.proxyId
    ? counterPartyParticipantFXPProxy === proxyObligation.creditorProxyOrParticipantId.proxyId
    : false
  if (isSameProxy) {
    messageKey = '0'
  } else {
    const participantName = cyrilResult.participantName
    const account = await Participant.getAccountByNameAndCurrency(
      participantName,
      cyrilResult.currencyId,
      Enum.Accounts.LedgerAccountType.POSITION
    )
    messageKey = account.participantCurrencyId.toString()
  }

  return {
    messageKey,
    cyrilResult
  }
}

const sendPositionPrepareMessage = async ({
  isFx,
  payload,
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
    throw reformatFSPIOPError(error)
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
      const transfer = await TransferService.getById(ID)
      if (!transfer) {
        const eventDetail = {
          functionality: Enum.Events.Event.Type.NOTIFICATION,
          action: Enum.Events.Event.Action.FORWARDED
        }
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND,
          'Forwarded transfer could not be found.'
        ).toApiErrorObject(Config.ERROR_HANDLING)
        // IMPORTANT: This singular message is taken by the ml-api-adapter and used to
        //            notify the payerFsp and proxy of the error.
        //            As long as the `to` and `from` message values are the payer and payee,
        //            and the action is `forwarded`, the ml-api-adapter will notify both.
        await Kafka.proceed(
          Config.KAFKA_CONFIG,
          params,
          {
            consumerCommit,
            fspiopError,
            eventDetail
          }
        )
        return true
      }

      if (transfer.transferState === Enum.Transfers.TransferInternalState.RESERVED) {
        await TransferService.forwardedPrepare(ID)
      } else {
        const eventDetail = {
          functionality: Enum.Events.Event.Type.NOTIFICATION,
          action: Enum.Events.Event.Action.FORWARDED
        }
        const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(
          `Invalid State: ${transfer.transferState} - expected: ${Enum.Transfers.TransferInternalState.RESERVED}`
        ).toApiErrorObject(Config.ERROR_HANDLING)
        // IMPORTANT: This singular message is taken by the ml-api-adapter and used to
        //            notify the payerFsp and proxy of the error.
        //            As long as the `to` and `from` message values are the payer and payee,
        //            and the action is `forwarded`, the ml-api-adapter will notify both.
        await Kafka.proceed(
          Config.KAFKA_CONFIG,
          params,
          {
            consumerCommit,
            fspiopError,
            eventDetail
          }
        )
      }
      return true
    }

    let debtorProxyOrParticipantId
    let creditorProxyOrParticipantId
    const proxyObligation = {
      isDebtorProxy: false,
      isCreditorProxy: false,
      debtorProxyOrParticipantId: null,
      creditorProxyOrParticipantId: null,
      payloadClone: { ...payload }
    }
    if (proxyEnabled) {
      // The initiatingFsp isn't always the debtor participant in all scenarios of /fxTransfers.
      // It is always the debtor in the current implementation of /fxTransfers.
      // The naming will have to be revisited after /fxTransfers implements receive type /fxTransfers.
      const [debtorFsp, creditorFsp] = isFx ? [payload.initiatingFsp, payload.counterPartyFsp] : [payload.payerFsp, payload.payeeFsp]
      ;[proxyObligation.debtorProxyOrParticipantId, proxyObligation.creditorProxyOrParticipantId] = await Promise.all([
        ProxyCache.getFSPProxy(debtorFsp),
        ProxyCache.getFSPProxy(creditorFsp)
      ])

      proxyObligation.isDebtorProxy = !proxyObligation.debtorProxyOrParticipantId.inScheme && proxyObligation.debtorProxyOrParticipantId.proxyId !== null
      proxyObligation.isCreditorProxy = !proxyObligation.creditorProxyOrParticipantId.inScheme && proxyObligation.creditorProxyOrParticipantId.proxyId !== null

      if (isFx) {
        proxyObligation.payloadClone.initiatingFsp = !proxyObligation.debtorProxyOrParticipantId?.inScheme && proxyObligation.debtorProxyOrParticipantId?.proxyId ? proxyObligation.debtorProxyOrParticipantId.proxyId : payload.initiatingFsp
        proxyObligation.payloadClone.counterPartyFsp = !proxyObligation.creditorProxyOrParticipantId?.inScheme && proxyObligation.creditorProxyOrParticipantId?.proxyId ? proxyObligation.creditorProxyOrParticipantId.proxyId : payload.counterPartyFsp
      } else {
        proxyObligation.payloadClone.payerFsp = !proxyObligation.debtorProxyOrParticipantId?.inScheme && proxyObligation.debtorProxyOrParticipantId?.proxyId ? proxyObligation.debtorProxyOrParticipantId.proxyId : payload.payerFsp
        proxyObligation.payloadClone.payeeFsp = !proxyObligation.creditorProxyOrParticipantId?.inScheme && proxyObligation.creditorProxyOrParticipantId?.proxyId ? proxyObligation.creditorProxyOrParticipantId.proxyId : payload.payeeFsp
      }

      // If either debtor participant or creditor participant aren't in the scheme and have no proxy representative, then throw an error.
      if ((proxyObligation.debtorProxyOrParticipantId.inScheme === false && proxyObligation.debtorProxyOrParticipantId.proxyId === null) ||
          (proxyObligation.creditorProxyOrParticipantId.inScheme === false && proxyObligation.creditorProxyOrParticipantId.proxyId === null)) {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND,
          `Payer proxy or payee proxy not found: debtor: ${debtorProxyOrParticipantId} creditor: ${creditorProxyOrParticipantId}`
        ).toApiErrorObject(Config.ERROR_HANDLING)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, {
          consumerCommit,
          fspiopError,
          eventDetail: { functionality, action },
          fromSwitch,
          hubName: Config.HUB_NAME
        })
        throw fspiopError
      }
    }

    const duplication = await checkDuplication({ payload, isFx, ID, location })
    if (duplication.hasDuplicateId) {
      const success = await processDuplication({
        duplication, isFx, ID, functionality, action, actionLetter, params, location
      })
      histTimerEnd({ success, fspId })
      return success
    }

    const determiningTransferCheckResult = await createRemittanceEntity(isFx).checkIfDeterminingTransferExists(
      proxyObligation.payloadClone,
      proxyObligation
    )

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
      logger.error(Util.breadcrumb(location, { path: 'validationFailed' }))
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
      throw fspiopError
    }

    logger.info(Util.breadcrumb(location, `positionTopic1--${actionLetter}7`))
    const success = await sendPositionPrepareMessage({
      isFx, payload, action, params, determiningTransferCheckResult, proxyObligation
    })

    histTimerEnd({ success, fspId })
    return success
  } catch (err) {
    histTimerEnd({ success: false, fspId })
    const fspiopError = reformatFSPIOPError(err)
    logger.error(`${Util.breadcrumb(location)}::${err.message}--P0`)
    logger.error(err.stack)
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
  checkDuplication,
  processDuplication,
  savePreparedRequest,
  definePositionParticipant,
  sendPositionPrepareMessage
}
