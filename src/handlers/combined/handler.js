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
 - James Bush <james.bush@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @module src/handlers/combined
 */

const util = require('util');
const Crypto = require('crypto')

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

const PositionService = require('../../domain/position')
const Utility = require('@mojaloop/central-services-shared').Util
const Uuid = require('uuid4')
const decodeMessages = require('@mojaloop/central-services-shared').Util.StreamingProtocol.decodeMessages

const StreamingProtocol = require('@mojaloop/central-services-stream').Util.StreamingProtocol


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
    Logger.info(Util.breadcrumb(location, { method: 'prepare' }))

    const actionLetter = action === TransferEventAction.PREPARE ? Enum.Events.ActionLetter.prepare
      : (action === TransferEventAction.BULK_PREPARE ? Enum.Events.ActionLetter.bulkPrepare
        : Enum.Events.ActionLetter.unknow)
    let functionality = action === TransferEventAction.PREPARE ? TransferEventType.NOTIFICATION
      : (action === TransferEventAction.BULK_PREPARE ? TransferEventType.BULK_PROCESSING
        : Enum.Events.ActionLetter.unknown)
    const params = { message, kafkaTopic, decodedPayload: payload, span, consumer: Consumer, producer: Producer }

    Logger.info(Util.breadcrumb(location, { path: 'dupCheck' }))

    const { hasDuplicateId, hasDuplicateHash } = await duplicateCheckComparator(transferId, payload, TransferService.getTransferDuplicateCheck, TransferService.saveTransferDuplicateCheck)
    if (hasDuplicateId && hasDuplicateHash) {
      Logger.info(Util.breadcrumb(location, 'handleResend'))
      const transfer = await TransferService.getByIdLight(transferId)
      const transferStateEnum = transfer && transfer.transferStateEnumeration
      const eventDetail = { functionality, action: TransferEventAction.PREPARE_DUPLICATE }
      if ([TransferState.COMMITTED, TransferState.ABORTED].includes(transferStateEnum)) {
        Logger.info(Util.breadcrumb(location, 'finalized'))
        if (action === TransferEventAction.PREPARE) {
          Logger.info(Util.breadcrumb(location, `callback--${actionLetter}1`))
          message.value.content.payload = TransferObjectTransform.toFulfil(transfer)
          message.value.content.uriParams = { id: transferId }
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          return true
        } else if (action === TransferEventAction.BULK_PREPARE) {
          Logger.info(Util.breadcrumb(location, `validationError1--${actionLetter}2`))
          const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST, 'Individual transfer prepare duplicate')
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
          throw fspiopError
        }
      } else {
        Logger.info(Util.breadcrumb(location, 'inProgress'))
        if (action === TransferEventAction.BULK_PREPARE) {
          Logger.info(Util.breadcrumb(location, `validationError2--${actionLetter}4`))
          const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST, 'Individual transfer prepare duplicate')
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
          throw fspiopError
        } else { // action === TransferEventAction.PREPARE
          Logger.info(Util.breadcrumb(location, `ignore--${actionLetter}3`))
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          return true
        }
      }
    } else if (hasDuplicateId && !hasDuplicateHash) {
      Logger.error(Util.breadcrumb(location, `callbackErrorModified1--${actionLetter}5`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST)
      const eventDetail = { functionality, action }
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError
    } else { // !hasDuplicateId
      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)
      if (validationPassed) {

        //NORMAL CASE - OPTIMISE FOR PERFORMANCE!!

        console.log('##### JEB OPTIMISED CODE');

        Logger.info(Util.breadcrumb(location, { path: 'validationPassed' }))
        try {
          Logger.info(Util.breadcrumb(location, 'saveTransfer'))
          await TransferService.prepare(payload)
        } catch (err) {
          Logger.info(Util.breadcrumb(location, `callbackErrorInternal1--${actionLetter}6`))
          Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
          const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err, ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
          const eventDetail = { functionality, action: TransferEventAction.PREPARE }
          /**
           * TODO: BULK-Handle at BulkProcessingHandler (not in scope of #967)
           * HOWTO: Stop execution at the `TransferService.prepare`, stop mysql,
           * continue execution to catch block, start mysql
           */
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
          throw fspiopError
        }

        Logger.info(Util.breadcrumb(location, `positionTopic1--${actionLetter}7`))
        functionality = TransferEventType.POSITION
        const eventDetail = { functionality, action }
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, toDestination })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true

      } else {
        Logger.error(Util.breadcrumb(location, { path: 'validationFailed' }))
        try {
          Logger.info(Util.breadcrumb(location, 'saveInvalidRequest'))
          await TransferService.prepare(payload, reasons.toString(), false)
        } catch (err) {
          Logger.info(Util.breadcrumb(location, `callbackErrorInternal2--${actionLetter}8`))
          Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
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
        Logger.info(Util.breadcrumb(location, `callbackErrorGeneric--${actionLetter}9`))
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
    throw ErrorHandler.Factory.reformatFSPIOPError(error)
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
      Logger.error(fspiopError)
      throw fspiopError
    }
    const kafkaTopic = message.topic
    Logger.info(Utility.breadcrumb(location, { method: 'positions' }))

    const actionLetter = action === Enum.Events.Event.Action.PREPARE ? Enum.Events.ActionLetter.prepare
      : (action === Enum.Events.Event.Action.COMMIT ? Enum.Events.ActionLetter.commit
        : (action === Enum.Events.Event.Action.REJECT ? Enum.Events.ActionLetter.reject
          : (action === Enum.Events.Event.Action.ABORT ? Enum.Events.ActionLetter.abort
            : (action === Enum.Events.Event.Action.TIMEOUT_RESERVED ? Enum.Events.ActionLetter.timeout
              : (action === Enum.Events.Event.Action.BULK_PREPARE ? Enum.Events.ActionLetter.bulkPrepare
                : (action === Enum.Events.Event.Action.BULK_COMMIT ? Enum.Events.ActionLetter.bulkCommit
                  : (action === Enum.Events.Event.Action.BULK_TIMEOUT_RESERVED ? Enum.Events.ActionLetter.bulkTimeoutReserved
                    : Enum.Events.ActionLetter.unknown)))))))
    const params = { message, kafkaTopic, decodedPayload: payload, span, consumer: Consumer, producer: Producer }
    const eventDetail = { action }
    if (![Enum.Events.Event.Action.BULK_PREPARE, Enum.Events.Event.Action.BULK_COMMIT, Enum.Events.Event.Action.BULK_TIMEOUT_RESERVED].includes(action)) {
      eventDetail.functionality = Enum.Events.Event.Type.NOTIFICATION
    } else {
      eventDetail.functionality = Enum.Events.Event.Type.BULK_PROCESSING
    }

    if (eventType === Enum.Events.Event.Type.POSITION && [Enum.Events.Event.Action.PREPARE, Enum.Events.Event.Action.BULK_PREPARE].includes(action)) {
      Logger.info(Utility.breadcrumb(location, { path: 'prepare' }))
      const { preparedMessagesList, limitAlarms } = await PositionService.calculatePreparePositionsBatch(decodeMessages(prepareBatch))
      for (const limit of limitAlarms) {
        // Publish alarm message to KafkaTopic for the Hub to consume as it is the Hub
        // rather than the switch to manage this (the topic is an participantEndpoint)
        Logger.info(`Limit alarm should be sent with ${limit}`)
      }
      for (const prepareMessage of preparedMessagesList) {
        const { transferState } = prepareMessage
        if (transferState.transferStateId === Enum.Transfers.TransferState.RESERVED) {
          Logger.info(Utility.breadcrumb(location, `payer--${actionLetter}1`))
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId, action })
          return true
        } else {
          Logger.info(Utility.breadcrumb(location, `payerNotifyInsufficientLiquidity--${actionLetter}2`))
          const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_INSUFFICIENT_LIQUIDITY)
          const fspiopApiError = fspiopError.toApiErrorObject(Config.ERROR_HANDLING)
          await TransferService.logTransferError(transferId, fspiopApiError.errorInformation.errorCode, fspiopApiError.errorInformation.errorDescription)
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopApiError, eventDetail, fromSwitch })
          throw fspiopError
        }
      }
    } else if (eventType === Enum.Events.Event.Type.POSITION && [Enum.Events.Event.Action.COMMIT, Enum.Events.Event.Action.BULK_COMMIT].includes(action)) {
      Logger.info(Utility.breadcrumb(location, { path: 'commit' }))
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.Accounts.TransferParticipantRoleType.PAYEE_DFSP, Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
      if (transferInfo.transferStateId !== Enum.Transfers.TransferInternalState.RECEIVED_FULFIL) {
        Logger.info(Utility.breadcrumb(location, `validationFailed::notReceivedFulfilState1--${actionLetter}3`))
        const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(`Invalid State: ${transferInfo.transferStateId} - expected: ${Enum.Transfers.TransferInternalState.RECEIVED_FULFIL}`)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
        throw fspiopError
      } else {
        Logger.info(Utility.breadcrumb(location, `payee--${actionLetter}4`))
        const isReversal = false
        const transferStateChange = {
          transferId: transferInfo.transferId,
          transferStateId: Enum.Transfers.TransferState.COMMITTED
        }
        await PositionService.changeParticipantPosition(transferInfo.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId, action })
        return true
      }
    } else if (eventType === Enum.Events.Event.Type.POSITION && [Enum.Events.Event.Action.REJECT, Enum.Events.Event.Action.ABORT].includes(action)) {
      Logger.info(Utility.breadcrumb(location, { path: action }))
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.Accounts.TransferParticipantRoleType.PAYER_DFSP, Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
      let transferStateId

      if (action === Enum.Events.Event.Action.REJECT) {
        Logger.info(Utility.breadcrumb(location, `receivedReject--${actionLetter}5`))
        transferStateId = Enum.Transfers.TransferInternalState.ABORTED_REJECTED
      } else { // action === Enum.Events.Event.Action.ABORT
        Logger.info(Utility.breadcrumb(location, `receivedError--${actionLetter}5`))
        transferStateId = Enum.Transfers.TransferInternalState.ABORTED_ERROR
      }
      const isReversal = true
      const transferStateChange = {
        transferId: transferInfo.transferId,
        transferStateId,
        reason: transferInfo.reason
      }
      await PositionService.changeParticipantPosition(transferInfo.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail })
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId, action })
      return true
    } else if (eventType === Enum.Events.Event.Type.POSITION && [Enum.Events.Event.Action.TIMEOUT_RESERVED, Enum.Events.Event.Action.BULK_TIMEOUT_RESERVED].includes(action)) {
      Logger.info(Utility.breadcrumb(location, { path: 'timeout' }))
      span.setTags({ transactionId: transferId })
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.Accounts.TransferParticipantRoleType.PAYER_DFSP, Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
      if (transferInfo.transferStateId !== Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT) {
        Logger.info(Utility.breadcrumb(location, `validationFailed::notReceivedFulfilState2--${actionLetter}6`))
        throw ErrorHandler.Factory.createInternalServerFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.message)
      } else {
        Logger.info(Utility.breadcrumb(location, `validationPassed2--${actionLetter}7`))
        const isReversal = true
        const transferStateChange = {
          transferId: transferInfo.transferId,
          transferStateId: Enum.Transfers.TransferInternalState.EXPIRED_RESERVED,
          reason: ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.message
        }
        await PositionService.changeParticipantPosition(transferInfo.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.EXPIRED_ERROR, null, null, null, payload.extensionList)
        if (action === Enum.Events.Event.Action.TIMEOUT_RESERVED) {
          eventDetail.action = Enum.Events.Event.Action.ABORT
        }
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail })
        throw fspiopError
      }
    } else {
      Logger.info(Utility.breadcrumb(location, `invalidEventTypeOrAction--${actionLetter}8`))
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(`Invalid event action:(${action}) and/or type:(${eventType})`)
      const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action: Enum.Events.Event.Action.POSITION }
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError
    }
  } catch (err) {
    Logger.error(`${Utility.breadcrumb(location)}::${err.message}--0`)
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
 * @function registerPreparePositionHandler
 *
 * @async
 * @description Registers the handler for prepare topic. Gets Kafka config from default.json
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerPreparePositionHandler = async () => {
  try {
    const preparePositionHandler = {
      command: preparePosition,
      topicName: Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, TransferEventType.TRANSFER, TransferEventAction.PREPARE),
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventAction.PREPARE.toUpperCase())
    }
    preparePositionHandler.config.rdkafkaConf['client.id'] = preparePositionHandler.topicName
    await Consumer.createHandler(preparePositionHandler.topicName, preparePositionHandler.config, preparePositionHandler.command)
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
    await registerPreparePositionHandler()
    return true
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}



module.exports = {
  preparePosition,
  registerPreparePositionHandler,
  registerAllHandlers
}
