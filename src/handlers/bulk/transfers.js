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
const BulkTransferService = require('../../domain/bulkTransfer')
const Util = require('../lib/utility')
const Kafka = require('../lib/kafka')
const Validator = require('./validator')
const Enum = require('../../lib/enum')
// const TransferState = Enum.TransferState
// const TransferStateEnum = Enum.TransferStateEnum
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction
// const Errors = require('../../lib/errors')
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../lib/config')
const decodePayload = require('@mojaloop/central-services-stream').Kafka.Protocol.decodePayload

// const errorType = Errors.errorType
const location = { module: 'BulkPrepareHandler', method: '', path: '' } // var object used as pointer
const consumerCommit = true
// const fromSwitch = true
const toDestination = true

/**
 * @function TransferBulkPrepareHandler
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
const bulkPrepare = async (request, h, error, messages) => { // TODO: remove request, h
  const histTimerEnd = Metrics.getHistogram(
    'transfer_bulk_prepare',
    'Consume a bulkPrepare transfer message from the kafka topic and process it accordingly',
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
    // decode payload
    const payload = (message && decodePayload(message.value.content.payload)) || request.payload // TODO: switch to message
    const headers = (message && message.value.content.headers) || request.headers // TODO: switch to message
    const action = (message && message.value.metadata.event.action) || 'bulk-prepare' // TODO: switch to message
    const bulkTransferId = payload.bulkTransferId
    const kafkaTopic = (message && message.topic) || 'bulk-prepare' // TODO: switch to message
    let consumer
    Logger.info(Util.breadcrumb(location, { method: 'bulkPrepare' }))
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (err) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(err)
      histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      // return true // TODO: enable
    }
    const actionLetter = action === TransferEventAction.BULK_PREPARE ? Enum.actionLetter.bulkPrepare : Enum.actionLetter.unknown
    let params = { message, bulkTransferId, kafkaTopic, consumer }

    Logger.info(Util.breadcrumb(location, { path: 'dupCheck' }))
    const { isDuplicateId, isResend } = await BulkTransferService.checkDuplicate(bulkTransferId, payload)
    if (isDuplicateId && isResend) { // TODO: handle resend
      Logger.info(Util.breadcrumb(location, `resend`))
      Logger.info(Util.breadcrumb(location, `notImplemented`))
      return true
      // const transferState = await BulkTransferService.getTransferStateChange(bulkTransferId)
      // const transferStateEnum = transferState && transferState.enumeration
      // if (!transferState) {
      //   Logger.error(Util.breadcrumb(location, `callbackErrorNotFound1--${actionLetter}1`))
      //   const errorInformation = Errors.getErrorInformation(errorType.internal, 'transfer/state not found')
      //   const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE }
      //   return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
      // } else if (transferStateEnum === TransferStateEnum.COMMITTED || transferStateEnum === TransferStateEnum.ABORTED) {
      //   Logger.info(Util.breadcrumb(location, `callbackFinilized1--${actionLetter}2`))
      //   let record = await BulkTransferService.getById(bulkTransferId)
      //   message.value.content.payload = TransferObjectTransform.toFulfil(record)
      //   const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE_DUPLICATE }
      //   return await Util.proceed(params, { consumerCommit, histTimerEnd, producer, fromSwitch })
      // } else if (transferStateEnum === TransferStateEnum.RECEIVED || transferStateEnum === TransferStateEnum.RESERVED) {
      //   Logger.info(Util.breadcrumb(location, `inProgress1--${actionLetter}3`))
      //   return await Util.proceed(params, { consumerCommit, histTimerEnd })
      // }
    }
    if (isDuplicateId && !isResend) { // TODO: handle modified request
      Logger.error(Util.breadcrumb(location, `callbackErrorModified1--${actionLetter}4`))
      Logger.info(Util.breadcrumb(location, `notImplemented`))
      return true
      // const errorInformation = Errors.getErrorInformation(errorType.modifiedRequest)
      // const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE }
      // return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
    }

    let { isValid, reasons, payerParticipantId, payeeParticipantId } = await Validator.validateBulkTransfer(payload, headers)
    if (isValid) {
      Logger.info(Util.breadcrumb(location, { path: 'isValid' }))
      try {
        Logger.info(Util.breadcrumb(location, `saveBulkTransfer`))
        await BulkTransferService.bulkPrepare(payload, { payerParticipantId, payeeParticipantId })
      } catch (err) { // TODO: handle insert error
        Logger.info(Util.breadcrumb(location, `callbackErrorInternal1--${actionLetter}5`))
        Logger.info(Util.breadcrumb(location, `notImplemented`))
        return true
        // Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
        // const errorInformation = Errors.getErrorInformation(errorType.internal)
        // const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE }
        // return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
      }
      Logger.info(Util.breadcrumb(location, `transferPrepareTopic1--${actionLetter}6`))
      const producer = { functionality: TransferEventType.TRANSFER, action: TransferEventAction.PREPARE }
      await Util.proceed(params, { consumerCommit, histTimerEnd, producer, toDestination })
    } else { // TODO: handle validation failure
      Logger.error(Util.breadcrumb(location, { path: 'validationFailed' }))
      try {
        Logger.info(Util.breadcrumb(location, `saveInvalidRequest`))
        await BulkTransferService.bulkPrepare(payload, { payerParticipantId, payeeParticipantId }, reasons.toString(), false)
      } catch (err) { // TODO: handle insert error
        Logger.info(Util.breadcrumb(location, `callbackErrorInternal2--${actionLetter}7`))
        Logger.info(Util.breadcrumb(location, `notImplemented`))
        return true
        // Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
        // const errorInformation = Errors.getErrorInformation(errorType.internal)
        // const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE }
        // return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
      }
      Logger.info(Util.breadcrumb(location, `callbackErrorGeneric--${actionLetter}8`))
      Logger.info(Util.breadcrumb(location, `notImplemented`))
      return true
      // TODO: store invalid bulk transfer to database and produce callback notification to payer
      // await BulkTransferService.logTransferError(bulkTransferId, errorType.generic, reasons.toString())
      // const errorInformation = Errors.getErrorInformation(errorType.generic, reasons.toString())
      // const producer = { functionality: TransferEventType.NOTIFICATION, action: TransferEventAction.PREPARE }
      // return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
    }
  } catch (err) {
    Logger.error(`${Util.breadcrumb(location)}::${err.message}--BP0`)
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    throw err
  }
}

/**
 * @function registerBulkPrepareHandler
 *
 * @async
 * @description Registers the handler for bulk-transfer topic. Gets Kafka config from default.json
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerBulkPrepareHandler = async () => {
  try {
    const bulkPrepareHandler = {
      command: bulkPrepare,
      topicName: Util.transformGeneralTopicName(TransferEventType.TRANSFER, TransferEventAction.PREPARE),
      config: Util.getKafkaConfig(Util.ENUMS.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventAction.PREPARE.toUpperCase())
    }
    bulkPrepareHandler.config.rdkafkaConf['client.id'] = bulkPrepareHandler.topicName
    await Kafka.Consumer.createHandler(bulkPrepareHandler.topicName, bulkPrepareHandler.config, bulkPrepareHandler.command)
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
 * @description Registers all handlers in transfers ie: bulkPrepare, bulkFulfil, etc.
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    await registerBulkPrepareHandler()
    return true
  } catch (e) {
    throw e
  }
}

module.exports = {
  bulkPrepare,
  registerAllHandlers
}
