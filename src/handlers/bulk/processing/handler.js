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
 --------------
 ******/
'use strict'

const Logger = require('@mojaloop/central-services-logger')
const BulkTransferService = require('../../../domain/bulkTransfer')
const Util = require('@mojaloop/central-services-shared').Util
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Producer = require('@mojaloop/central-services-stream').Util.Producer
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../../lib/config')
const decodePayload = require('@mojaloop/central-services-shared').Util.StreamingProtocol.decodePayload
const BulkTransferModels = require('@mojaloop/central-object-store').Models.BulkTransfer
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const location = { module: 'BulkProcessingHandler', method: '', path: '' } // var object used as pointer

const consumerCommit = true
const fromSwitch = true

/**
 * @function BulkProcessingHandler
 *
 * @async
 * @description This is the consumer callback function that gets registered to a topic. This then gets a list of messages,
 * we will only ever use the first message in non batch processing. We then break down the message into its payload and
 * begin validating the payload. Once the payload is validated successfully it will be written to the database to
 * the relevant tables. If the validation fails it is still written to the database for auditing purposes but with an
 * INVALID status. For any duplicate requests we will send appropriate callback based on the transfer state and the hash
 * validation.
 *
 * Module.method called to consume a bulkProcessing transfer message from the kafka topic and process it accordingly
 *
 * @param {error} error - error thrown if something fails within Kafka
 * @param {array} messages - a list of messages to consume for the relevant topic
 *
 * @returns {object} - Returns a boolean: true if successful, or throws and error if failed
 */
const bulkProcessing = async (error, messages) => {
  const histTimerEnd = Metrics.getHistogram(
    'transfer_bulk_processing',
    'Consume a bulkProcessing transfer message from the kafka topic and process it accordingly',
    ['success', 'fspId']
  ).startTimer()
  if (error) {
    // Logger.isErrorEnabled && Logger.error(error)
    throw error
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
    const eventType = message.value.metadata.event.type
    const action = message.value.metadata.event.action
    const state = message.value.metadata.event.state
    const transferId = payload.transferId || (message.value.content.uriParams && message.value.content.uriParams.id)
    const kafkaTopic = message.topic
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { method: 'bulkProcessing' }))

    const actionLetter = action === Enum.Events.Event.Action.BULK_PREPARE ? Enum.Events.ActionLetter.bulkPrepare
      : (action === Enum.Events.Event.Action.BULK_COMMIT ? Enum.Events.ActionLetter.bulkCommit
        : (action === Enum.Events.Event.Action.BULK_TIMEOUT_RECEIVED ? Enum.Events.ActionLetter.bulkTimeoutReceived
          : (action === Enum.Events.Event.Action.BULK_TIMEOUT_RESERVED ? Enum.Events.ActionLetter.bulkTimeoutReserved
            : (action === Enum.Events.Event.Action.PREPARE_DUPLICATE ? Enum.Events.ActionLetter.bulkPrepareDuplicate
              : (action === Enum.Events.Event.Action.FULFIL_DUPLICATE ? Enum.Events.ActionLetter.bulkFulfilDuplicate
                : (action === Enum.Events.Event.Action.BULK_ABORT ? Enum.Events.ActionLetter.bulkAbort
                  : Enum.Events.ActionLetter.unknown))))))
    const params = { message, kafkaTopic, decodedPayload: payload, consumer: Consumer, producer: Producer }
    const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action }

    /**
     * Acquire bulk transfer info by transferId below needs to be improved. Currently, if
     * an individual transfer fulfil is attempted as part of another bulk, bulkTransferInfo
     * refers to the original bulkTransferId where that inidividual transfer has been added
     * initially. This leads to an error which could be hard to trace back and determine
     * the reason why it occured. Instead, the aquired bulkTransferInfo.bulkTransferId
     * needs to be compared to the original bulkTransferId currently processed and an error
     * needs to be thrown when these not match. The underlying problem is that as part of
     * the reused chain prepare-position-bulk-processing / fulfil-position-bulk-processing,
     * the bulkTransferId is not being transmitted!
     *
     * TODO: Add bulkTransferId field to messages from PrepareHandler and PositionHandler
     * and compare the transmitted bulkTransferId to the bellow bulkTransferInfo.bulkTransferId
     * (not in scope of #967)
     */
    const bulkTransferInfo = await BulkTransferService.getBulkTransferState(transferId) // TODO: This is not ideal, as the transferId might be from another bulk

    let criteriaState, incompleteBulkState, completedBulkState, bulkTransferState, processingStateId, errorCode, errorDescription
    let produceNotification = false

    if ([Enum.Transfers.BulkTransferState.RECEIVED, Enum.Transfers.BulkTransferState.PENDING_PREPARE].includes(bulkTransferInfo.bulkTransferStateId)) {
      criteriaState = Enum.Transfers.BulkTransferState.RECEIVED
      incompleteBulkState = Enum.Transfers.BulkTransferState.PENDING_PREPARE
      completedBulkState = Enum.Transfers.BulkTransferState.ACCEPTED
      if (action === Enum.Events.Event.Action.PREPARE_DUPLICATE && state.status === Enum.Events.EventState.ERROR) {
        processingStateId = Enum.Transfers.BulkProcessingState.RECEIVED_DUPLICATE
        errorCode = payload.errorInformation.errorCode
        errorDescription = payload.errorInformation.errorDescription
      } else if (action === Enum.Events.Event.Action.BULK_PREPARE && state.status === Enum.Events.EventState.ERROR) {
        processingStateId = Enum.Transfers.BulkProcessingState.RECEIVED_INVALID
        errorCode = payload.errorInformation.errorCode
        errorDescription = payload.errorInformation.errorDescription
      } else if (action === Enum.Events.Event.Action.BULK_PREPARE && state.status === Enum.Events.EventState.SUCCESS) {
        processingStateId = Enum.Transfers.BulkProcessingState.ACCEPTED
      } else if ([Enum.Events.Event.Action.BULK_TIMEOUT_RECEIVED, Enum.Events.Event.Action.BULK_TIMEOUT_RESERVED].includes(action)) {
        incompleteBulkState = Enum.Transfers.BulkTransferState.EXPIRING
        completedBulkState = Enum.Transfers.BulkTransferState.COMPLETED
        processingStateId = Enum.Transfers.BulkProcessingState.EXPIRED
        errorCode = payload.errorInformation && payload.errorInformation.errorCode
        errorDescription = payload.errorInformation && payload.errorInformation.errorDescription
      } else {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `Invalid action for bulk in ${Enum.Transfers.BulkTransferState.RECEIVED} state`)
        throw fspiopError
      }
    } else if ([Enum.Transfers.BulkTransferState.ACCEPTED].includes(bulkTransferInfo.bulkTransferStateId)) {
      if (action === Enum.Events.Event.Action.BULK_TIMEOUT_RESERVED) {
        criteriaState = Enum.Transfers.BulkTransferState.ACCEPTED
        incompleteBulkState = Enum.Transfers.BulkTransferState.EXPIRING
        completedBulkState = Enum.Transfers.BulkTransferState.COMPLETED
        processingStateId = Enum.Transfers.BulkProcessingState.EXPIRED
        errorCode = payload.errorInformation && payload.errorInformation.errorCode
        errorDescription = payload.errorInformation && payload.errorInformation.errorDescription
      } else {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `Invalid action for bulk in ${Enum.Transfers.BulkTransferState.ACCEPTED} state`)
        throw fspiopError
      }
    } else if ([Enum.Transfers.BulkTransferState.PROCESSING, Enum.Transfers.BulkTransferState.PENDING_FULFIL, Enum.Transfers.BulkTransferState.EXPIRING].includes(bulkTransferInfo.bulkTransferStateId)) {
      criteriaState = Enum.Transfers.BulkTransferState.PROCESSING
      incompleteBulkState = Enum.Transfers.BulkTransferState.PENDING_FULFIL
      completedBulkState = Enum.Transfers.BulkTransferState.COMPLETED
      if (action === Enum.Events.Event.Action.FULFIL_DUPLICATE) {
        processingStateId = Enum.Transfers.BulkProcessingState.FULFIL_DUPLICATE
      } else if (action === Enum.Events.Event.Action.BULK_COMMIT && state.status === Enum.Events.EventState.SUCCESS) {
        processingStateId = Enum.Transfers.BulkProcessingState.COMPLETED
      } else if (action === Enum.Events.Event.Action.REJECT && state.status === Enum.Events.EventState.SUCCESS) {
        processingStateId = Enum.Transfers.BulkProcessingState.REJECTED
      } else if ([Enum.Events.Event.Action.COMMIT, Enum.Events.Event.Action.ABORT].includes(action) && state.status === Enum.Events.EventState.ERROR) {
        processingStateId = Enum.Transfers.BulkProcessingState.FULFIL_INVALID
      } else if (action === Enum.Events.Event.Action.BULK_TIMEOUT_RESERVED) {
        incompleteBulkState = Enum.Transfers.BulkTransferState.EXPIRING
        completedBulkState = Enum.Transfers.BulkTransferState.COMPLETED
        processingStateId = Enum.Transfers.BulkProcessingState.EXPIRED
        errorCode = payload.errorInformation && payload.errorInformation.errorCode
        errorDescription = payload.errorInformation && payload.errorInformation.errorDescription
      } else if (action === Enum.Events.Event.Action.BULK_ABORT) {
        // TODO: Need to validate `state.status`
        processingStateId = Enum.Transfers.BulkProcessingState.REJECTED
        completedBulkState = Enum.Transfers.BulkTransferState.REJECTED
        errorCode = payload.errorInformation && payload.errorInformation.errorCode
        errorDescription = payload.errorInformation && payload.errorInformation.errorDescription
      } else {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `Invalid action for bulk in ${Enum.Transfers.BulkTransferState.PROCESSING} state`)
        throw fspiopError
      }
    } else if (bulkTransferInfo.bulkTransferStateId === Enum.Transfers.BulkTransferState.COMPLETED && action === Enum.Events.Event.Action.FULFIL_DUPLICATE) {
      /**
       * Bulk transfer state is detected as COMPLETED, because data is fetched by trasnferId,
       * not by bulkTransferId, thus the duplicate fulfil refers to the original bulk where
       * it exists, not the current bulk in which duplicate fulfil is included.
       *
       * TODO:967 BULK-NEEDS_CLAIRTY - Currently this is only added to the log and no
       * errorInformation is queued to be sent to Payee for the duplicate fulfil.
       * Also, please be aware, that such a duplicate fulfil may be processed after
       * all expected individual transfers have been processed and notification has
       * been sent to parties!
       */
      let fspiopError
      if (payload && payload.errorInformation) {
        fspiopError = ErrorHandler.Factory.createFSPIOPErrorFromErrorInformation(payload.errorInformation) // handles Modified request errorInformation payload
      } else {
        fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `fulfil-duplicate error occurred for transferId ${transferId}`)
      }
      throw fspiopError
    } else { // ['PENDING_INVALID', 'COMPLETED', 'REJECTED', 'INVALID']
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `Could not process transferId ${transferId} after bulk is finilized`)
      throw fspiopError
    }

    await BulkTransferService.bulkTransferAssociationUpdate(
      transferId, bulkTransferInfo.bulkTransferId, {
        bulkProcessingStateId: processingStateId,
        errorCode,
        errorDescription
      })
    let exists
    if (criteriaState !== Enum.Transfers.BulkTransferState.PROCESSING) {
      exists = await BulkTransferService.bulkTransferAssociationExists(
        bulkTransferInfo.bulkTransferId,
        Enum.Transfers.BulkProcessingState[criteriaState]
      )
    } else {
      exists = await BulkTransferService.bulkTransferAssociationExists(
        bulkTransferInfo.bulkTransferId,
        Enum.Transfers.BulkProcessingState[Enum.Transfers.BulkTransferState.PROCESSING]
      ) || await BulkTransferService.bulkTransferAssociationExists(
        bulkTransferInfo.bulkTransferId,
        Enum.Transfers.BulkProcessingState[Enum.Transfers.BulkTransferState.ACCEPTED]
      )
    }
    if (exists) {
      bulkTransferState = incompleteBulkState
    } else {
      bulkTransferState = completedBulkState
      produceNotification = true
    }
    if (bulkTransferState !== bulkTransferInfo.bulkTransferStateId) {
      await BulkTransferService.createBulkTransferState({
        bulkTransferId: bulkTransferInfo.bulkTransferId,
        bulkTransferStateId: bulkTransferState,
        reason: errorDescription || null
      })
    }

    let getBulkTransferByIdResult
    if (produceNotification) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'produceNotification' }))
      getBulkTransferByIdResult = await BulkTransferService.getBulkTransferById(bulkTransferInfo.bulkTransferId)
    } else {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'awaitAllTransfers' }))
      criteriaState = null // debugging breakpoint line
      return true
    }

    if (produceNotification) {
      if (eventType === Enum.Events.Event.Type.BULK_PROCESSING && action === Enum.Events.Event.Action.BULK_PREPARE) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `bulkPrepare--${actionLetter}2`))
        const payeeBulkResponse = Object.assign({}, { messageId: message.value.id, headers }, getBulkTransferByIdResult.payeeBulkTransfer)
        const payeeIndividualTransfers = payeeBulkResponse.individualTransferResults.filter(individualTransfer => {
          return !individualTransfer.errorInformation
        })
        if (payeeIndividualTransfers.length) {
          payeeBulkResponse.individualTransferResults = payeeIndividualTransfers
          const BulkTransferResultModel = BulkTransferModels.getBulkTransferResultModel()
          await (new BulkTransferResultModel(payeeBulkResponse)).save()
          const payload = Util.omitNil({
            bulkTransferId: payeeBulkResponse.bulkTransferId,
            bulkQuoteId: getBulkTransferByIdResult.bulkQuoteId,
            payerFsp: getBulkTransferByIdResult.payerFsp,
            payeeFsp: getBulkTransferByIdResult.payeeFsp,
            expiration: getBulkTransferByIdResult.expiration,
            extensionList: payeeBulkResponse.extensionList
          })
          const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(params.message.value.metadata.event.id, params.message.value.metadata.type, params.message.value.metadata.action, Enum.Events.EventStatus.SUCCESS)
          params.message.value = Util.StreamingProtocol.createMessage(params.message.value.id, payeeBulkResponse.destination, payeeBulkResponse.headers[Enum.Http.Headers.FSPIOP.SOURCE], metadata, payeeBulkResponse.headers, payload)
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          return true
        } else {
          // TODO: handle use case when no individual transfer has been accepted:
          // Switch to finilize bulk state and notify payer with PUT /bulkTransfers/{id}
          // const payerBulkResponse = Object.assign({}, { messageId: message.value.id, headers }, getBulkTransferByIdResult.payerBulkTransfer)
          Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `noTransfers--${actionLetter}1`))
          Logger.isErrorEnabled && Logger.error(Util.breadcrumb(location, 'notImplemented'))
          return true
        }
      } else if (eventType === Enum.Events.Event.Type.BULK_PROCESSING && [Enum.Events.Event.Action.BULK_COMMIT, Enum.Events.Event.Action.BULK_TIMEOUT_RECEIVED, Enum.Events.Event.Action.BULK_TIMEOUT_RESERVED, Enum.Events.Event.Action.BULK_ABORT].includes(action)) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `bulkFulfil--${actionLetter}3`))
        const participants = await BulkTransferService.getParticipantsById(bulkTransferInfo.bulkTransferId)
        const normalizedKeys = Object.keys(headers).reduce((keys, k) => { keys[k.toLowerCase()] = k; return keys }, {})
        const payeeBulkResponseHeaders = Util.Headers.transformHeaders(headers, { httpMethod: headers[normalizedKeys[Enum.Http.Headers.FSPIOP.HTTP_METHOD]], sourceFsp: Enum.Http.Headers.FSPIOP.SWITCH.value, destinationFsp: participants.payeeFsp })
        delete payeeBulkResponseHeaders[normalizedKeys[Enum.Http.Headers.FSPIOP.SIGNATURE]]
        const payerBulkResponse = Object.assign({}, { messageId: message.value.id, headers: Util.clone(headers) }, getBulkTransferByIdResult.payerBulkTransfer)
        const payeeBulkResponse = Object.assign({}, { messageId: message.value.id, headers: payeeBulkResponseHeaders }, getBulkTransferByIdResult.payeeBulkTransfer)
        const BulkTransferResultModel = BulkTransferModels.getBulkTransferResultModel()
        await (new BulkTransferResultModel(payerBulkResponse)).save()
        await (new BulkTransferResultModel(payeeBulkResponse)).save()
        const payerParams = Util.clone(params)
        const payeeParams = Util.clone(params)
        let payerPayload
        let payeePayload

        if (action === Enum.Events.Event.Action.BULK_ABORT && params.decodedPayload.errorInformation) {
          payerPayload = { bulkTransferId: payerBulkResponse.bulkTransferId, errorInformation: params.decodedPayload.errorInformation }
          payeePayload = { bulkTransferId: payeeBulkResponse.bulkTransferId, errorInformation: params.decodedPayload.errorInformation }
        } else {
          payerPayload = Util.omitNil({
            bulkTransferId: payerBulkResponse.bulkTransferId,
            bulkTransferState: payerBulkResponse.bulkTransferState,
            completedTimestamp: payerBulkResponse.completedTimestamp,
            extensionList: payerBulkResponse.extensionList
          })
          payeePayload = Util.omitNil({
            bulkTransferId: payeeBulkResponse.bulkTransferId,
            bulkTransferState: payeeBulkResponse.bulkTransferState,
            completedTimestamp: payeeBulkResponse.completedTimestamp,
            extensionList: payeeBulkResponse.extensionList
          })
        }

        const payerMetadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(params.message.value.metadata.event.id, payerParams.message.value.metadata.type, payerParams.message.value.metadata.action, Enum.Events.EventStatus.SUCCESS)
        payerParams.message.value = Util.StreamingProtocol.createMessage(params.message.value.id, participants.payerFsp, payerBulkResponse.headers[normalizedKeys[Enum.Http.Headers.FSPIOP.SOURCE]], payerMetadata, payerBulkResponse.headers, payerPayload)

        const payeeMetadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(params.message.value.metadata.event.id, payeeParams.message.value.metadata.type, payeeParams.message.value.metadata.action, Enum.Events.EventStatus.SUCCESS)
        payeeParams.message.value = Util.StreamingProtocol.createMessage(params.message.value.id, participants.payeeFsp, Enum.Http.Headers.FSPIOP.SWITCH.value, payeeMetadata, payeeBulkResponse.headers, payeePayload)
        if ([Enum.Events.Event.Action.BULK_TIMEOUT_RECEIVED, Enum.Events.Event.Action.BULK_TIMEOUT_RESERVED].includes(action)) {
          eventDetail.action = Enum.Events.Event.Action.BULK_COMMIT
        } else if ([Enum.Events.Event.Action.BULK_ABORT].includes(action)) {
          eventDetail.action = Enum.Events.Event.Action.BULK_ABORT
        }
        await Kafka.proceed(Config.KAFKA_CONFIG, payerParams, { consumerCommit, eventDetail })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        await Kafka.proceed(Config.KAFKA_CONFIG, payeeParams, { consumerCommit, eventDetail })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      } else if (eventType === Enum.Events.Event.Type.BULK_PROCESSING && [Enum.Events.Event.Action.BULK_TIMEOUT_RECEIVED, Enum.Events.Event.Action.BULK_TIMEOUT_RESERVED].includes(action)) {
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED, null, null, null, payload.extensionList)
        eventDetail.action = Enum.Events.Event.Action.BULK_ABORT
        params.message.value.content.uriParams.id = bulkTransferInfo.bulkTransferId
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail })
        throw fspiopError
      } else {
        // TODO: For the following (Internal Server Error) scenario a notification is produced for each individual transfer.
        // It also needs to be processed first in order to accumulate transfers and send the callback notification at bulk level.
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `invalidEventTypeOrAction--${actionLetter}4`))
        const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(`Invalid event action:(${action}) and/or type:(${eventType})`).toApiErrorObject(Config.ERROR_HANDLING)
        const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action: Enum.Events.Event.Action.BULK_PROCESSING }
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError, eventDetail, fromSwitch })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
    }
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(`${Util.breadcrumb(location)}::${err.message}--BP0`)
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/**
 * @function registerBulkProcessingHandler
 *
 * @async
 * @description Registers the handler for bulk-transfer topic. Gets Kafka config from default.json
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerBulkProcessingHandler = async () => {
  try {
    const bulkProcessingHandler = {
      command: bulkProcessing,
      topicName: Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, Enum.Events.Event.Type.BULK, Enum.Events.Event.Action.PROCESSING),
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, Enum.Events.Event.Type.BULK.toUpperCase(), Enum.Events.Event.Action.PROCESSING.toUpperCase())
    }
    bulkProcessingHandler.config.rdkafkaConf['client.id'] = bulkProcessingHandler.topicName
    await Consumer.createHandler(bulkProcessingHandler.topicName, bulkProcessingHandler.config, bulkProcessingHandler.command)
    return true
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/**
 * @function RegisterAllHandlers
 *
 * @async
 * @description Registers all module handlers
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    await registerBulkProcessingHandler()
    return true
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  bulkProcessing,
  registerBulkProcessingHandler,
  registerAllHandlers
}
