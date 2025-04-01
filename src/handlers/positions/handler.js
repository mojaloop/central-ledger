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
 - Lazola Lucas <lazola.lucas@modusbox.com>
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 - Miguel de Barros <miguel.debarros@modusbox.com>
 - Valentin Genev <valentin.genev@modusbox.com>
 - Shashikant Hirugade <shashikant.hirugade@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @module src/handlers/positions
 */

const Logger = require('../../shared/logger').logger
const EventSdk = require('@mojaloop/event-sdk')
const TransferService = require('../../domain/transfer')
const TransferObjectTransform = require('../../domain/transfer/transform')
const PositionService = require('../../domain/position')
const participantFacade = require('../../models/participant/facade')
const SettlementModelCached = require('../../models/settlement/settlementModelCached')
const Utility = require('@mojaloop/central-services-shared').Util
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Producer = require('@mojaloop/central-services-stream').Util.Producer
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../lib/config')
const { randomUUID } = require('crypto')
const decodePayload = require('@mojaloop/central-services-shared').Util.StreamingProtocol.decodePayload
const decodeMessages = require('@mojaloop/central-services-shared').Util.StreamingProtocol.decodeMessages
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const location = { module: 'PositionHandler', method: '', path: '' } // var object used as pointer
const rethrow = require('../../shared/rethrow')
const consumerCommit = true
const fromSwitch = true

/**
 * @function positions
 *
 * @async
 * @description This is the consumer callback function that gets registered to a topic. This then gets a list of messages,
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

const positions = async (error, messages) => {
  const histTimerEnd = Metrics.getHistogram(
    'transfer_position',
    'Consume a prepare transfer message from the kafka topic and process it accordingly',
    ['success', 'fspId', 'action']
  ).startTimer()

  if (error) {
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId, action: 'error' })
    rethrow.rethrowAndCountFspiopError(error, { operation: 'positionsHandler' })
  }
  let message = {}
  let prepareBatch = []
  let contextFromMessage
  let span
  let action
  try {
    if (Array.isArray(messages)) {
      prepareBatch = Array.from(messages)
      message = Object.assign(message, Utility.clone(prepareBatch[0]))
    } else {
      prepareBatch = [Object.assign({}, Utility.clone(messages))]
      message = Object.assign({}, messages)
    }
    contextFromMessage = EventSdk.Tracer.extractContextFromMessage(message.value)
    span = EventSdk.Tracer.createChildSpanFromContext('cl_transfer_position', contextFromMessage)
    await span.audit(message, EventSdk.AuditEventAction.start)
    const payload = decodePayload(message.value.content.payload)
    const eventType = message.value.metadata.event.type
    action = message.value.metadata.event.action
    const transferId = payload.transferId || (message.value.content.uriParams && message.value.content.uriParams.id)
    if (!transferId) {
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError('transferId is null or undefined')
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'positionsHandler' })
    }

    const kafkaTopic = message.topic
    Logger.isInfoEnabled && Logger.info(Utility.breadcrumb(location, { method: 'positions' }))

    const actionLetter = action === Enum.Events.Event.Action.PREPARE
      ? Enum.Events.ActionLetter.prepare
      : (action === Enum.Events.Event.Action.RESERVE
          ? Enum.Events.ActionLetter.reserve
          : (action === Enum.Events.Event.Action.COMMIT
              ? Enum.Events.ActionLetter.commit
              : (action === Enum.Events.Event.Action.REJECT
                  ? Enum.Events.ActionLetter.reject
                  : (action === Enum.Events.Event.Action.ABORT
                      ? Enum.Events.ActionLetter.abort
                      : (action === Enum.Events.Event.Action.TIMEOUT_RESERVED
                          ? Enum.Events.ActionLetter.timeout
                          : (action === Enum.Events.Event.Action.BULK_PREPARE
                              ? Enum.Events.ActionLetter.bulkPrepare
                              : (action === Enum.Events.Event.Action.BULK_COMMIT
                                  ? Enum.Events.ActionLetter.bulkCommit
                                  : (action === Enum.Events.Event.Action.BULK_TIMEOUT_RESERVED
                                      ? Enum.Events.ActionLetter.bulkTimeoutReserved
                                      : (action === Enum.Events.Event.Action.BULK_ABORT
                                          ? Enum.Events.ActionLetter.bulkAbort
                                          : Enum.Events.ActionLetter.unknown)))))))))
    const params = { message, kafkaTopic, decodedPayload: payload, span, consumer: Consumer, producer: Producer }
    const eventDetail = { action }
    if (![Enum.Events.Event.Action.BULK_PREPARE, Enum.Events.Event.Action.BULK_COMMIT, Enum.Events.Event.Action.BULK_TIMEOUT_RESERVED, Enum.Events.Event.Action.BULK_ABORT].includes(action)) {
      eventDetail.functionality = Enum.Events.Event.Type.NOTIFICATION
    } else {
      eventDetail.functionality = Enum.Events.Event.Type.BULK_PROCESSING
    }

    if (eventType === Enum.Events.Event.Type.POSITION && [Enum.Events.Event.Action.PREPARE, Enum.Events.Event.Action.BULK_PREPARE].includes(action)) {
      Logger.isInfoEnabled && Logger.info(Utility.breadcrumb(location, { path: 'prepare' }))
      const { preparedMessagesList, limitAlarms } = await PositionService.calculatePreparePositionsBatch(decodeMessages(prepareBatch))
      for (const limit of limitAlarms) {
        // Publish alarm message to KafkaTopic for the Hub to consume as it is the Hub
        // rather than the switch to manage this (the topic is an participantEndpoint)
        Logger.isInfoEnabled && Logger.info(`Limit alarm should be sent with ${limit}`)
      }
      if (Array.isArray(preparedMessagesList) && preparedMessagesList.length > 0) {
        const prepareMessage = preparedMessagesList[0]
        const { transferState, fspiopError } = prepareMessage
        if (transferState.transferStateId === Enum.Transfers.TransferState.RESERVED) {
          Logger.isInfoEnabled && Logger.info(Utility.breadcrumb(location, `payer--${actionLetter}1`))
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, hubName: Config.HUB_NAME })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId, action })
          return true
        } else {
          Logger.isInfoEnabled && Logger.info(Utility.breadcrumb(location, `payerNotifyInsufficientLiquidity--${actionLetter}2`))
          const responseFspiopError = fspiopError || ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
          const fspiopApiError = responseFspiopError.toApiErrorObject(Config.ERROR_HANDLING)
          await TransferService.logTransferError(transferId, fspiopApiError.errorInformation.errorCode, fspiopApiError.errorInformation.errorDescription)
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopApiError, eventDetail, fromSwitch, hubName: Config.HUB_NAME })
          rethrow.rethrowAndCountFspiopError(responseFspiopError, { operation: 'positionsHandler' })
        }
      }
    } else if (eventType === Enum.Events.Event.Type.POSITION && [Enum.Events.Event.Action.COMMIT, Enum.Events.Event.Action.RESERVE, Enum.Events.Event.Action.BULK_COMMIT].includes(action)) {
      Logger.isInfoEnabled && Logger.info(Utility.breadcrumb(location, { path: 'commit' }))
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.Accounts.TransferParticipantRoleType.PAYEE_DFSP, Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
      const participantCurrency = await participantFacade.getByIDAndCurrency(transferInfo.participantId, transferInfo.currencyId, Enum.Accounts.LedgerAccountType.POSITION)
      if (transferInfo.transferStateId !== Enum.Transfers.TransferInternalState.RECEIVED_FULFIL) {
        Logger.isInfoEnabled && Logger.info(Utility.breadcrumb(location, `validationFailed::notReceivedFulfilState1--${actionLetter}3`))
        const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(`Invalid State: ${transferInfo.transferStateId} - expected: ${Enum.Transfers.TransferInternalState.RECEIVED_FULFIL}`)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'positionsHandler' })
      } else {
        Logger.isInfoEnabled && Logger.info(Utility.breadcrumb(location, `payee--${actionLetter}4`))
        const isReversal = false
        const transferStateChange = {
          transferId: transferInfo.transferId,
          transferStateId: Enum.Transfers.TransferState.COMMITTED
        }
        await PositionService.changeParticipantPosition(participantCurrency.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
        if (action === Enum.Events.Event.Action.RESERVE) {
          const transfer = await TransferService.getById(transferInfo.transferId)
          message.value.content.payload = TransferObjectTransform.toFulfil(transfer)
        }
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, hubName: Config.HUB_NAME })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId, action })
        return true
      }
    } else if (eventType === Enum.Events.Event.Type.POSITION && [Enum.Events.Event.Action.REJECT, Enum.Events.Event.Action.ABORT, Enum.Events.Event.Action.ABORT_VALIDATION, Enum.Events.Event.Action.BULK_ABORT].includes(action)) {
      Logger.isInfoEnabled && Logger.info(Utility.breadcrumb(location, { path: action }))
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.Accounts.TransferParticipantRoleType.PAYER_DFSP, Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
      const participantCurrency = await participantFacade.getByIDAndCurrency(transferInfo.participantId, transferInfo.currencyId, Enum.Accounts.LedgerAccountType.POSITION)
      let transferStateId

      if (action === Enum.Events.Event.Action.REJECT) {
        Logger.isInfoEnabled && Logger.info(Utility.breadcrumb(location, `receivedReject--${actionLetter}5`))
        transferStateId = Enum.Transfers.TransferInternalState.ABORTED_REJECTED
      } else { // action === Enum.Events.Event.Action.ABORT || action === Enum.Events.Event.Action.BULK_ABORT
        Logger.isInfoEnabled && Logger.info(Utility.breadcrumb(location, `receivedError--${actionLetter}5`))
        transferStateId = Enum.Transfers.TransferInternalState.ABORTED_ERROR
      }
      const isReversal = true
      const transferStateChange = {
        transferId: transferInfo.transferId,
        transferStateId,
        reason: transferInfo.reason
      }
      await PositionService.changeParticipantPosition(participantCurrency.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, hubName: Config.HUB_NAME })
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId, action })
      return true
    } else if (eventType === Enum.Events.Event.Type.POSITION && [Enum.Events.Event.Action.TIMEOUT_RESERVED, Enum.Events.Event.Action.BULK_TIMEOUT_RESERVED].includes(action)) {
      Logger.isInfoEnabled && Logger.info(Utility.breadcrumb(location, { path: 'timeout' }))
      span.setTags({ transactionId: transferId })
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.Accounts.TransferParticipantRoleType.PAYER_DFSP, Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
      const participantCurrency = await participantFacade.getByIDAndCurrency(transferInfo.participantId, transferInfo.currencyId, Enum.Accounts.LedgerAccountType.POSITION)
      if (transferInfo.transferStateId !== Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT) {
        Logger.isInfoEnabled && Logger.info(Utility.breadcrumb(location, `validationFailed::notReceivedFulfilState2--${actionLetter}6`))
        const error = ErrorHandler.Factory.createInternalServerFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.message)
        rethrow.rethrowAndCountFspiopError(error, { operation: 'positionsHandler' })
      } else {
        Logger.isInfoEnabled && Logger.info(Utility.breadcrumb(location, `validationPassed2--${actionLetter}7`))
        const isReversal = true
        const transferStateChange = {
          transferId: transferInfo.transferId,
          transferStateId: Enum.Transfers.TransferInternalState.EXPIRED_RESERVED,
          reason: ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.message
        }
        await PositionService.changeParticipantPosition(participantCurrency.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED, null, null, null, payload.extensionList)
        await Kafka.proceed(
          Config.KAFKA_CONFIG,
          params,
          {
            consumerCommit,
            fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING),
            eventDetail,
            hubName: Config.HUB_NAME
          })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'positionsHandler' })
      }
    } else {
      Logger.isInfoEnabled && Logger.info(Utility.breadcrumb(location, `invalidEventTypeOrAction--${actionLetter}8`))
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(`Invalid event action:(${action}) and/or type:(${eventType})`)
      const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action: Enum.Events.Event.Action.POSITION }
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'positionsHandler' })
    }
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(`${Utility.breadcrumb(location)}::${err.message}--0`)
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId, action })
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

/**
 * @function registerPositionHandler
 *
 * @async
 * @description Registers the handler for position topic. Gets Kafka config from default.json
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerPositionHandler = async () => {
  try {
    await SettlementModelCached.initialize()
    const positionHandler = {
      command: positions,
      topicName: Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, Enum.Events.Event.Type.POSITION, Enum.Events.Event.Action.PREPARE),
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, Enum.Events.Event.Type.TRANSFER.toUpperCase(), Enum.Events.Event.Action.POSITION.toUpperCase())
    }
    positionHandler.config.rdkafkaConf['client.id'] = `${positionHandler.config.rdkafkaConf['client.id']}-${randomUUID()}`
    await Consumer.createHandler(positionHandler.topicName, positionHandler.config, positionHandler.command)
    return true
  } catch (err) {
    rethrow.rethrowAndCountFspiopError(err, { operation: 'registerPositionHandler' })
  }
}

/**
 * @function RegisterAllHandlers
 *
 * @async
 * @description Registers all handlers in positions
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    return await registerPositionHandler()
  } catch (err) {
    rethrow.rethrowAndCountFspiopError(err, { operation: 'registerAllHandlers' })
  }
}

module.exports = {
  registerPositionHandler,
  registerAllHandlers,
  positions
}
