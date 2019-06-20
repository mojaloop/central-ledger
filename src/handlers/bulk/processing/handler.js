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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/
'use strict'

const Logger = require('@mojaloop/central-services-shared').Logger
const BulkTransferService = require('../../../domain/bulkTransfer')
const LibUtil = require('../../../lib/util')
const Util = require('../../lib/utility')
const Kafka = require('../../lib/kafka')
// const Validator = require('../shared/validator')
const Enum = require('../../../lib/enum')
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction
const Errors = require('../../../lib/errors')
const errorType = Errors.errorType
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../../lib/config')
const decodePayload = require('@mojaloop/central-services-stream').Kafka.Protocol.decodePayload
const BulkTransferModels = require('@mojaloop/central-object-store').Models.BulkTransfer

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
 * Module.method called to [TODO add description here]
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
    const actionLetter = action === TransferEventAction.BULK_PREPARE ? Enum.actionLetter.bulkPrepare
      : (action === TransferEventAction.BULK_FULFIL ? Enum.actionLetter.bulkFulfil
        : Enum.actionLetter.unknown)
    let params = { message, kafkaTopic, consumer }
    let producer = { functionality: TransferEventType.NOTIFICATION, action }

    const bulkTransferInfo = await BulkTransferService.getBulkTransferState(transferId)
    // Logger.info(`bulkTransferInfo=${JSON.stringify(bulkTransferInfo)}`)
    let criteriaState, incompleteBulkState, completedBulkState, bulkTransferState, processingStateId, errorCode, errorDescription, exitCode
    let produceNotification = false

    if ([Enum.BulkTransferState.RECEIVED, Enum.BulkTransferState.PENDING_PREPARE].indexOf(bulkTransferInfo.bulkTransferStateId) !== -1) {
      criteriaState = Enum.BulkTransferState.RECEIVED
      incompleteBulkState = Enum.BulkTransferState.PENDING_PREPARE
      completedBulkState = Enum.BulkTransferState.ACCEPTED
      if (action === TransferEventAction.PREPARE_DUPLICATE) {
        processingStateId = Enum.BulkProcessingState.RECEIVED_DUPLICATE
      } else if (action === TransferEventAction.BULK_PREPARE && state.status === Enum.transferEventState.ERROR) {
        processingStateId = Enum.BulkProcessingState.RECEIVED_INVALID
        errorCode = payload.errorInformation.errorCode
        errorDescription = payload.errorInformation.errorDescription
      } else if (action === TransferEventAction.BULK_PREPARE && state.status === Enum.transferEventState.SUCCESS) {
        processingStateId = Enum.BulkProcessingState.ACCEPTED
      } else if ([TransferEventAction.TIMEOUT_RECEIVED, TransferEventAction.TIMEOUT_RESERVED].indexOf(action) !== -1) {
        incompleteBulkState = null
        completedBulkState = Enum.BulkTransferState.COMPLETED
        processingStateId = Enum.BulkProcessingState.EXPIRED
      } else {
        exitCode = 2
        errorCode = 2 // TODO: Change to MLAPI spec defined error and move description text to enum
        errorDescription = `Invalid action for bulk in ${Enum.BulkTransferState.RECEIVED} state`
      }
    } else if ([Enum.BulkTransferState.ACCEPTED].indexOf(bulkTransferInfo.bulkTransferStateId) !== -1) {
      if (action === TransferEventAction.TIMEOUT_RESERVED) {
        criteriaState = Enum.BulkTransferState.ACCEPTED
        incompleteBulkState = null
        completedBulkState = Enum.BulkTransferState.COMPLETED
        processingStateId = Enum.BulkProcessingState.EXPIRED
      } else {
        exitCode = 3
        errorCode = 3 // TODO: Change to MLAPI spec defined error and move description text to enum
        errorDescription = errorDescription = `Invalid action for bulk in ${Enum.BulkTransferState.ACCEPTED} state`
      }
    } else if ([Enum.BulkTransferState.PROCESSING, Enum.BulkTransferState.PENDING_FULFIL].indexOf(bulkTransferInfo.bulkTransferStateId) !== -1) {
      criteriaState = Enum.BulkTransferState.ACCEPTED
      incompleteBulkState = Enum.BulkTransferState.PENDING_FULFIL
      completedBulkState = Enum.BulkTransferState.COMPLETED
      if (action === TransferEventAction.FULFIL_DUPLICATE) {
        processingStateId = Enum.BulkProcessingState.FULFIL_DUPLICATE
      } else if (action === TransferEventAction.COMMIT && state.status === Enum.transferEventState.SUCCESS) {
        processingStateId = Enum.BulkProcessingState.COMPLETED
      } else if (action === TransferEventAction.REJECT && state.status === Enum.transferEventState.SUCCESS) {
        processingStateId = Enum.BulkProcessingState.REJECTED
      } else if ([TransferEventAction.COMMIT, TransferEventAction.ABORT].indexOf(action) !== -1 && state.status === Enum.transferEventState.ERROR) {
        processingStateId = Enum.BulkProcessingState.FULFIL_INVALID
      } else if (action === Enum.TransferEventAction.TIMEOUT_RESERVED) {
        incompleteBulkState = null
        completedBulkState = Enum.BulkTransferState.COMPLETED
        processingStateId = Enum.BulkProcessingState.EXPIRED
      } else {
        exitCode = 4
        errorCode = 4 // TODO: Change to MLAPI spec defined error and move description text to enum
        errorDescription = `Invalid action for bulk in ${Enum.BulkTransferState.PROCESSING} state`
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
    let exists = await BulkTransferService.bulkTransferAssociationExists(
      bulkTransferInfo.bulkTransferId,
      Enum.BulkProcessingState[criteriaState]
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
      Logger.info(Util.breadcrumb(location, { path: `awaitAllTransfers` }))
      criteriaState = null // debugging breakpoint line
      return true
    }

    if (produceNotification) {
      if (eventType === TransferEventType.BULK_PROCESSING && action === TransferEventAction.BULK_PREPARE) {
        Logger.info(Util.breadcrumb(location, `bulkPrepare--${actionLetter}1`))
        const payeeBulkResponse = Object.assign({}, { messageId: message.value.id, headers }, getBulkTransferByIdResult.payeeBulkTransfer)
        let BulkTransferResponseModel = BulkTransferModels.getBulkTransferResponseModel()
        await (new BulkTransferResponseModel(payeeBulkResponse)).save()
        let payload = LibUtil.omitNil({
          bulkTransferId: payeeBulkResponse.bulkTransferId,
          bulkTransferState: payeeBulkResponse.bulkTransferState,
          completedTimestamp: payeeBulkResponse.completedTimestamp,
          extensionList: payeeBulkResponse.extensionList
        })
        params.message.value = {
          id: params.message.value.id,
          from: payeeBulkResponse.headers['fspiop-source'],
          to: payeeBulkResponse.destination,
          content: {
            headers: payeeBulkResponse.headers,
            payload
          },
          type: 'application/json',
          metadata: {
            event: {
              id: params.message.value.metadata.event.id,
              state: { status: 'success', code: 0, description: 'action successful' },
              createdAt: new Date()
            }
          }
        }
        await Util.proceed(params, { consumerCommit, histTimerEnd, producer })
        return true
      } else if (eventType === TransferEventType.BULK_PROCESSING && action === TransferEventAction.BULK_FULFIL) {
        Logger.info(Util.breadcrumb(location, { path: 'bulkFulfil' }))
        // TODO: implement bulk-fulfil here
        Logger.info(Util.breadcrumb(location, `flowEnd--${actionLetter}2`))
        Logger.info(Util.breadcrumb(location, `notImplemented`))
        return true
      } else {
        // TODO: For the following (Internal Server Error) scenario a notification is produced for each individual transfer.
        // It also needs to be processed first in order to accumulate transfers and send the callback notification at bulk level.
        Logger.info(Util.breadcrumb(location, `invalidEventTypeOrAction--${actionLetter}3`))
        const errorInformation = Errors.getErrorInformation(errorType.internal)
        const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.BULK_PROCESSING }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
      }
    }
  } catch (err) {
    Logger.error(`${Util.breadcrumb(location)}::${err.message}--BP0`)
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    throw err
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
      topicName: Util.transformGeneralTopicName(TransferEventType.BULK, TransferEventAction.PROCESSING),
      config: Util.getKafkaConfig(Util.ENUMS.CONSUMER, TransferEventType.BULK.toUpperCase(), TransferEventAction.PROCESSING.toUpperCase())
    }
    bulkProcessingHandler.config.rdkafkaConf['client.id'] = bulkProcessingHandler.topicName
    await Kafka.Consumer.createHandler(bulkProcessingHandler.topicName, bulkProcessingHandler.config, bulkProcessingHandler.command)
    return true
  } catch (e) {
    Logger.error(e)
    throw e
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
  } catch (e) {
    throw e
  }
}

module.exports = {
  bulkProcessing,
  registerAllHandlers
}
