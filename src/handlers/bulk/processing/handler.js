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

const Logger = require('@mojaloop/central-services-shared').Logger
const BulkTransferService = require('../../../domain/bulkTransfer')
const Util = require('@mojaloop/central-services-shared').Util
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Enum = require('@mojaloop/central-services-shared').Enum
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../../lib/config')
const decodePayload = require('@mojaloop/central-services-stream').Kafka.Protocol.decodePayload
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
    // Logger.error(error)
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
    let consumer
    Logger.info(Util.breadcrumb(location, { method: 'bulkProcessing' }))
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (err) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(err)
      histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    const actionLetter = action === Enum.Events.Event.Action.BULK_PREPARE ? Enum.Events.ActionLetter.bulkPrepare
      : (action === Enum.Events.Event.Action.BULK_FULFIL ? Enum.Events.ActionLetter.bulkFulfil
        : (action === Enum.Events.Event.Action.BULK_COMMIT ? Enum.Events.ActionLetter.bulkCommit
          : Enum.Events.ActionLetter.unknown))
    const params = { message, kafkaTopic, consumer, decodedPayload: payload }
    const producer = { functionality: Enum.Events.Event.Type.NOTIFICATION, action }

    const bulkTransferInfo = await BulkTransferService.getBulkTransferState(transferId)
    let criteriaState, incompleteBulkState, completedBulkState, bulkTransferState, processingStateId, errorCode, errorDescription, exitCode
    let produceNotification = false

    if ([Enum.Transfers.BulkTransferState.RECEIVED, Enum.Transfers.BulkTransferStateEnum.PENDING_PREPARE].includes(bulkTransferInfo.bulkTransferStateId)) {
      criteriaState = Enum.Transfers.BulkTransferState.RECEIVED
      incompleteBulkState = Enum.Transfers.BulkTransferStateEnum.PENDING_PREPARE
      completedBulkState = Enum.Transfers.BulkTransferState.ACCEPTED
      if (action === Enum.Events.Event.Action.PREPARE_DUPLICATE) {
        processingStateId = Enum.Transfers.BulkProcessingState.RECEIVED_DUPLICATE
      } else if (action === Enum.Events.Event.Action.BULK_PREPARE && state.status === Enum.Events.EventState.ERROR) {
        processingStateId = Enum.Transfers.BulkProcessingState.RECEIVED_INVALID
        errorCode = payload.errorInformation.errorCode
        errorDescription = payload.errorInformation.errorDescription
      } else if (action === Enum.Events.Event.Action.BULK_PREPARE && state.status === Enum.Events.EventState.SUCCESS) {
        processingStateId = Enum.Transfers.BulkProcessingState.ACCEPTED
      } else if ([Enum.Events.Event.Action.TIMEOUT_RECEIVED, Enum.Events.Event.Action.TIMEOUT_RESERVED].includes(action)) {
        incompleteBulkState = null
        completedBulkState = Enum.Transfers.BulkTransferState.COMPLETED
        processingStateId = Enum.Transfers.BulkProcessingState.EXPIRED
      } else {
        exitCode = 2
        errorCode = 2 // TODO: Change to MLAPI spec defined error and move description text to enum
        errorDescription = `Invalid action for bulk in ${Enum.Transfers.BulkTransferState.RECEIVED} state`
      }
    } else if ([Enum.Transfers.BulkTransferState.ACCEPTED].includes(bulkTransferInfo.bulkTransferStateId)) {
      if (action === Enum.Events.Event.Action.TIMEOUT_RESERVED) {
        criteriaState = Enum.Transfers.BulkTransferState.ACCEPTED
        incompleteBulkState = null
        completedBulkState = Enum.Transfers.BulkTransferState.COMPLETED
        processingStateId = Enum.Transfers.BulkProcessingState.EXPIRED
      } else {
        exitCode = 3
        errorCode = 3 // TODO: Change to MLAPI spec defined error and move description text to enum
        errorDescription = `Invalid action for bulk in ${Enum.Transfers.BulkTransferState.ACCEPTED} state`
      }
    } else if ([Enum.Transfers.BulkTransferState.PROCESSING, Enum.Transfers.BulkTransferState.PENDING_FULFIL].includes(bulkTransferInfo.bulkTransferStateId)) {
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
      } else if (action === Enum.Events.Event.Action.TIMEOUT_RESERVED) {
        incompleteBulkState = null
        completedBulkState = Enum.Transfers.BulkTransferState.COMPLETED
        processingStateId = Enum.Transfers.BulkProcessingState.EXPIRED
      } else {
        exitCode = 4
        errorCode = 4 // TODO: Change to MLAPI spec defined error and move description text to enum
        errorDescription = `Invalid action for bulk in ${Enum.Transfers.BulkTransferState.PROCESSING} state`
      }
    } else { // ['PENDING_INVALID', 'COMPLETED', 'REJECTED', 'INVALID']
      exitCode = 1
      errorCode = 1 // TODO: Change to MLAPI spec defined error and move description text to enum
      errorDescription = 'Individual transfer can not be processed when bulk transfer state is final'
    }
    await BulkTransferService.bulkTransferAssociationUpdate(
      transferId, bulkTransferInfo.bulkTransferId, {
        bulkProcessingStateId: processingStateId,
        errorCode,
        errorDescription
      })
    const exists = await BulkTransferService.bulkTransferAssociationExists(
      bulkTransferInfo.bulkTransferId,
      Enum.Transfers.BulkProcessingState[criteriaState]
    )
    if (exists) {
      bulkTransferState = incompleteBulkState
    } else {
      bulkTransferState = completedBulkState
      produceNotification = true
    }
    await BulkTransferService.createBulkTransferState({
      bulkTransferId: bulkTransferInfo.bulkTransferId,
      bulkTransferStateId: bulkTransferState
    })

    let getBulkTransferByIdResult
    if (exitCode > 0) {
      Logger.info(Util.breadcrumb(location, { path: 'exitCodeGt0' }))
      // TODO: Prepare Bulk Error Notification callback message
    } else if (produceNotification) {
      Logger.info(Util.breadcrumb(location, { path: 'produceNotification' }))
      getBulkTransferByIdResult = await BulkTransferService.getBulkTransferById(bulkTransferInfo.bulkTransferId)
    } else {
      Logger.info(Util.breadcrumb(location, { path: 'awaitAllTransfers' }))
      criteriaState = null // debugging breakpoint line
      return true
    }

    if (produceNotification) {
      if (eventType === Enum.Events.Event.Type.BULK_PROCESSING && action === Enum.Events.Event.Action.BULK_PREPARE) {
        Logger.info(Util.breadcrumb(location, `bulkPrepare--${actionLetter}1`))
        const payeeBulkResponse = Object.assign({}, { messageId: message.value.id, headers }, getBulkTransferByIdResult.payeeBulkTransfer)
        const BulkTransferResultModel = BulkTransferModels.getBulkTransferResultModel()
        await (new BulkTransferResultModel(payeeBulkResponse)).save()
        const payload = Util.omitNil({
          bulkTransferId: payeeBulkResponse.bulkTransferId,
          bulkTransferState: payeeBulkResponse.bulkTransferState,
          completedTimestamp: payeeBulkResponse.completedTimestamp,
          extensionList: payeeBulkResponse.extensionList
        })
        const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(params.message.value.metadata.event.id, params.message.value.metadata.type, params.message.value.metadata.action, Enum.Events.EventStatus.SUCCESS)
        params.message.value = Util.StreamingProtocol.createMessage(params.message.value.id, payeeBulkResponse.destination, payeeBulkResponse.headers[Enum.Http.Headers.FSPIOP.SOURCE], metadata, payeeBulkResponse.headers, payload)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, producer })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      } else if (eventType === Enum.Events.Event.Type.BULK_PROCESSING && action === Enum.Events.Event.Action.BULK_COMMIT) {
        Logger.info(Util.breadcrumb(location, `bulkFulfil--${actionLetter}2`))
        const participants = await BulkTransferService.getParticipantsById(bulkTransferInfo.bulkTransferId)
        const payerBulkResponse = Object.assign({}, { messageId: message.value.id, headers: Util.clone(headers) }, getBulkTransferByIdResult.payerBulkTransfer)
        const payeeBulkResponse = Object.assign({}, { messageId: message.value.id, headers: Util.clone(headers) }, getBulkTransferByIdResult.payeeBulkTransfer)
        payeeBulkResponse.headers[Enum.Http.Headers.FSPIOP.SOURCE] = Enum.headers.FSPIOP.SWITCH
        payeeBulkResponse.headers[Enum.Http.Headers.FSPIOP.DESTINATION] = participants.payeeFsp
        delete payeeBulkResponse.headers[Enum.Http.Headers.FSPIOP.SIGNATURE]
        const BulkTransferResultModel = BulkTransferModels.getBulkTransferResultModel()
        await (new BulkTransferResultModel(payerBulkResponse)).save()
        await (new BulkTransferResultModel(payeeBulkResponse)).save()
        const payerParams = Util.clone(params)
        const payeeParams = Util.clone(params)

        const payerPayload = Util.omitNil({
          bulkTransferId: payerBulkResponse.bulkTransferId,
          bulkTransferState: payerBulkResponse.bulkTransferState,
          completedTimestamp: payerBulkResponse.completedTimestamp,
          extensionList: payerBulkResponse.extensionList
        })
        const payerMetadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(params.message.value.metadata.event.id, payerParams.message.value.metadata.type, payerParams.message.value.metadata.action, Enum.Events.EventStatus.SUCCESS)
        payerParams.message.value = Util.StreamingProtocol.createMessage(params.message.value.id, participants.payerFsp, payerBulkResponse.headers[Enum.Http.Headers.FSPIOP.SOURCE], payerMetadata, payerBulkResponse.headers, payerPayload)
        const payeePayload = Util.omitNil({
          bulkTransferId: payeeBulkResponse.bulkTransferId,
          bulkTransferState: payeeBulkResponse.bulkTransferState,
          completedTimestamp: payeeBulkResponse.completedTimestamp,
          extensionList: payeeBulkResponse.extensionList
        })
        const payeeMetadata = Util.StreamingProtocol.createMetadataWithCorrelatedEvent(params.message.value.metadata.event.id, payeeParams.message.value.metadata.type, payeeParams.message.value.metadata.action, Enum.Events.EventStatus.SUCCESS)
        payeeParams.message.value = Util.StreamingProtocol.createMessage(params.message.value.id, participants.payeeFsp, Enum.Http.Headers.FSPIOP.SWITCH.value, payeeMetadata, payeeBulkResponse.headers, payeePayload)
        await Kafka.proceed(payerParams, { consumerCommit, producer })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        await Kafka.proceed(payeeParams, { consumerCommit, producer })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      } else {
        // TODO: For the following (Internal Server Error) scenario a notification is produced for each individual transfer.
        // It also needs to be processed first in order to accumulate transfers and send the callback notification at bulk level.
        Logger.info(Util.breadcrumb(location, `invalidEventTypeOrAction--${actionLetter}3`))
        const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(`Invalid event action:(${action}) and/or type:(${eventType})`).toApiErrorObject()
        const producer = { functionality: Enum.Events.Event.Type.NOTIFICATION, action: Enum.Events.Event.Action.BULK_PROCESSING }
        await Kafka.proceed(params, { consumerCommit, fspiopError, producer, fromSwitch })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
    }
  } catch (err) {
    Logger.error(`${Util.breadcrumb(location)}::${err.message}--BP0`)
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
    await Kafka.Consumer.createHandler(bulkProcessingHandler.topicName, bulkProcessingHandler.config, bulkProcessingHandler.command)
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
