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
 * Lazola Lucas <lazola.lucas@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Deon Botha <deon.botha@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @module src/handlers/transfers
 */

const Logger = require('@mojaloop/central-services-shared').Logger
const TransferService = require('../../domain/transfer')
const Util = require('../lib/utility')
const Kafka = require('../lib/kafka')
const Validator = require('./validator')
const Enum = require('../../lib/enum')
const TransferState = Enum.TransferState
const TransferStateEnum = Enum.TransferStateEnum
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction
const TransferObjectTransform = require('../../domain/transfer/transform')
const Errors = require('../../lib/errors')
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../lib/config')
const Uuid = require('uuid4')

// TODO: This errorCode and errorDescription are dummy values until a rules engine is established
const errorGenericCode = 3100
const errorGenericDescription = Errors.getErrorDescription(errorGenericCode)
const errorModifiedReqCode = 3106
const errorModifiedReqDescription = Errors.getErrorDescription(errorModifiedReqCode)
const errorInternalCode = 2001
const errorInternalDescription = Errors.getErrorDescription(errorInternalCode)
const errorTransferExpCode = 3300
const errorTransferExpDescription = Errors.getErrorDescription(errorTransferExpCode)
const errorTransferIdNotFoundCode = 3208
const errorTransferIdNotFoundDescription = Errors.getErrorDescription(errorTransferIdNotFoundCode)

const location = { module: 'PrepareHandler', method: '', path: '' }
// const replyFromSwitch = true

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
 * TransferService.validateDuplicateHash called to validate/insert the hash of the payload of the message
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
  const histTimerEnd = Metrics.getHistogram(
    'transfer_prepare',
    'Consume a prepare transfer message from the kafka topic and process it accordingly',
    ['success', 'fspId']
  ).startTimer()
  if (error) {
    // Logger.error(error)
    throw new Error()
  }
  let message = {}
  try {
    if (Array.isArray(messages)) {
      message = messages[0]
    } else {
      message = messages
    }
    const payload = message.value.content.payload
    const headers = message.value.content.headers
    const metadata = message.value.metadata
    const action = metadata.event.action
    const transferId = payload.transferId
    const kafkaTopic = message.topic
    let metadataState
    let consumer
    Logger.info(Util.breadcrumb(location, { method: 'prepare' }))
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (err) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(err)
      histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    // Action Letter (AL) is used to denote breadcrumb flow end
    const AL = action === TransferEventAction.PREPARE ? 'P' : '?'

    Logger.info(Util.breadcrumb(location, { path: 'dupCheck' }))
    const { existsMatching, existsNotMatching } = await TransferService.validateDuplicateHash(transferId, payload)
    if (existsMatching) {
      Logger.info(Util.breadcrumb(location, `existsMatching`))
      const transferState = await TransferService.getTransferStateChange(transferId)
      const transferStateEnum = transferState && transferState.enumeration
      if (!transferState) {
        Logger.error(Util.breadcrumb(location, `callbackErrorNotFound1--${AL}1`))
        await Util.commitMessageSync(kafkaTopic, consumer, message)
        const errorDescription = `${errorInternalDescription}: transfer state not found`
        message.value.content.payload = Util.createPrepareErrorStatus(errorInternalCode, errorDescription, message.value.content.payload.extensionList)
        metadataState = Util.createState(Util.ENUMS.STATE.FAILURE.status, errorInternalCode, errorDescription)
        await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE, message.value, metadataState, transferId)
      } else if (transferStateEnum === TransferStateEnum.COMMITTED || transferStateEnum === TransferStateEnum.ABORTED) {
        Logger.info(Util.breadcrumb(location, `callbackFinilized1--${AL}2`))
        await Util.commitMessageSync(kafkaTopic, consumer, message)
        let record = await TransferService.getById(transferId)
        message.value.to = message.value.from
        message.value.from = Enum.headers.FSPIOP.SWITCH
        message.value.content.payload = TransferObjectTransform.toFulfil(record)
        metadataState = Util.ENUMS.STATE.SUCCESS
        await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE_DUPLICATE, message.value, metadataState, transferId)
      } else if (transferStateEnum === TransferStateEnum.RECEIVED || transferStateEnum === TransferStateEnum.RESERVED) {
        Logger.info(Util.breadcrumb(location, `inProgress1--${AL}3`))
        await Util.commitMessageSync(kafkaTopic, consumer, message)
      }
    }
    if (existsNotMatching) {
      Logger.error(Util.breadcrumb(location, `callbackErrorModified1--${AL}4`))
      await Util.commitMessageSync(kafkaTopic, consumer, message)
      message.value.content.payload = Util.createPrepareErrorStatus(errorModifiedReqCode, errorModifiedReqDescription, message.value.content.payload.extensionList)
      metadataState = Util.createState(Util.ENUMS.STATE.FAILURE.status, errorModifiedReqCode, errorModifiedReqDescription)
      await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE, message.value, metadataState, transferId)
    }
    if (existsMatching || existsNotMatching) {
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }

    let { validationPassed, reasons } = await Validator.validateByName(payload, headers)
    if (validationPassed) {
      Logger.info(Util.breadcrumb(location, { path: 'validationPassed' }))
      try {
        Logger.info(Util.breadcrumb(location, `saveTransfer`))
        await TransferService.prepare(payload)
      } catch (err) {
        Logger.info(Util.breadcrumb(location, `callbackErrorInternal1--${AL}5`))
        Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
        await Util.commitMessageSync(kafkaTopic, consumer, message)
        message.value.content.payload = Util.createPrepareErrorStatus(errorInternalCode, errorInternalDescription, message.value.content.payload.extensionList)
        metadataState = Util.createState(Util.ENUMS.STATE.FAILURE.status, errorInternalCode, errorInternalDescription)
        await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE, message.value, metadataState, transferId)
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
      Logger.info(Util.breadcrumb(location, `positionTopic1--${AL}6`))
      await Util.commitMessageSync(kafkaTopic, consumer, message)
      await Util.produceGeneralMessage(TransferEventType.POSITION, TransferEventAction.PREPARE, message.value, Util.ENUMS.STATE.SUCCESS, headers[Enum.headers.FSPIOP.DESTINATION])
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    } else {
      Logger.error(Util.breadcrumb(location, { path: 'validationFailed' }))
      try {
        Logger.info(Util.breadcrumb(location, `saveInvalidRequest`))
        await TransferService.prepare(payload, reasons.toString(), false)
      } catch (err) {
        Logger.info(Util.breadcrumb(location, `callbackErrorInternal2--${AL}7`))
        Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
        await Util.commitMessageSync(kafkaTopic, consumer, message)
        message.value.content.payload = Util.createPrepareErrorStatus(errorInternalCode, errorInternalDescription, message.value.content.payload.extensionList)
        metadataState = Util.createState(Util.ENUMS.STATE.FAILURE.status, errorInternalCode, errorInternalDescription)
        await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE, message.value, metadataState, transferId)
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
      Logger.info(Util.breadcrumb(location, `callbackErrorGeneric--${AL}8`))
      await Util.commitMessageSync(kafkaTopic, consumer, message)
      await TransferService.logTransferError(transferId, errorGenericCode, reasons.toString())
      const errorDescription = `${errorGenericDescription}: ${reasons.toString()}`
      message.value.content.payload = Util.createPrepareErrorStatus(errorGenericCode, errorDescription, message.value.content.payload.extensionList)
      metadataState = Util.createState(Util.ENUMS.STATE.FAILURE.status, errorGenericCode, errorDescription)
      await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE, message.value, metadataState, transferId)
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
  } catch (err) {
    Logger.error(`${Util.breadcrumb(location)}::${err.message}--P0`)
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    throw err
  }
}

const fulfil = async (error, messages) => {
  const histTimerEnd = Metrics.getHistogram(
    'transfer_fulfil',
    'Consume a fulfil transfer message from the kafka topic and process it accordingly',
    ['success', 'fspId']
  ).startTimer()
  if (error) {
    // Logger.error(error)
    throw new Error()
  }
  let message = {}
  try {
    if (Array.isArray(messages)) {
      message = messages[0]
    } else {
      message = messages
    }
    const payload = message.value.content.payload
    const headers = message.value.content.headers
    const metadata = message.value.metadata
    const action = metadata.event.action
    const transferId = message.value.id
    const kafkaTopic = message.topic
    let metadataState
    let consumer
    Logger.info(Util.breadcrumb(location, { method: `fulfil:${action}` }))
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (e) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(e)
      histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    // Action Letter (AL) is used to denote breadcrumb flow end
    const AL = action === TransferEventAction.COMMIT ? 'C'
      : (action === TransferEventAction.REJECT ? 'R'
        : (action === TransferEventAction.ABORT ? 'A'
          : '?'))
    // fulfil-specific declarations
    const isTransferError = action === TransferEventAction.ABORT
    const transferFulfilmentId = Uuid()

    Logger.info(Util.breadcrumb(location, { path: 'dupCheck' }))
    const { existsMatching, existsNotMatching, isValid, transferErrorDuplicateCheckId } =
      await TransferService.validateDuplicateHash(transferId, payload, transferFulfilmentId, isTransferError)

    if (existsMatching) {
      Logger.info(Util.breadcrumb(location, `existsMatching`))
      await Util.commitMessageSync(kafkaTopic, consumer, message)
      const transferState = await TransferService.getTransferStateChange(transferId)
      const transferStateEnum = transferState && transferState.enumeration
      message.value.to = message.value.from
      message.value.from = Enum.headers.FSPIOP.SWITCH

      if (!transferState) {
        Logger.error(Util.breadcrumb(location, `callbackErrorNotFound2--${AL}1`))
        const errorDescription = `${errorInternalDescription}: transfer state not found`
        message.value.content.payload = Util.createPrepareErrorStatus(errorInternalCode, errorDescription, payload.extensionList)
        metadataState = Util.createState(Util.ENUMS.STATE.FAILURE.status, errorInternalCode, errorDescription)
        await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, metadataState, payload.transferId)
      } else if (transferStateEnum === TransferStateEnum.COMMITTED || transferStateEnum === TransferStateEnum.ABORTED) {
        if (!isTransferError) {
          if (isValid) {
            Logger.info(Util.breadcrumb(location, `callbackFinilized2--${AL}2`))
            let record = await TransferService.getById(transferId)
            message.value.content.payload = TransferObjectTransform.toFulfil(record)
            metadataState = Util.ENUMS.STATE.SUCCESS
            await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.FULFIL_DUPLICATE, message.value, metadataState, payload.transferId)
          } else {
            Logger.info(Util.breadcrumb(location, `callbackErrorModified2--${AL}3`))
            message.value.content.payload = Util.createPrepareErrorStatus(errorModifiedReqCode, errorModifiedReqDescription, payload.extensionList)
            metadataState = Util.createState(Util.ENUMS.STATE.FAILURE.status, errorModifiedReqCode, errorModifiedReqDescription)
            await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.FULFIL_DUPLICATE, message.value, metadataState, payload.transferId)
          }
        } else {
          if (isValid) {
            Logger.info(Util.breadcrumb(location, `break--${AL}2`))
          } else {
            Logger.info(Util.breadcrumb(location, `breakModified1--${AL}3`))
          }
        }
      } else if (transferStateEnum === TransferStateEnum.RECEIVED || transferStateEnum === TransferStateEnum.RESERVED) {
        Logger.info(Util.breadcrumb(location, `inProgress2--${AL}4`))
      }
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    if (existsNotMatching) {
      Logger.info(Util.breadcrumb(location, `existsNotMatching`))
      if (!isTransferError) {
        Logger.info(Util.breadcrumb(location, `inProgress3--${AL}5`))
      } else {
        Logger.info(Util.breadcrumb(location, `breakModified2--${AL}5`))
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
    }

    if (metadata.event.type === TransferEventType.FULFIL &&
      (action === TransferEventAction.COMMIT ||
        action === TransferEventAction.REJECT ||
        action === TransferEventAction.ABORT)) {
      const existingTransfer = await TransferService.getById(transferId)

      Util.breadcrumb(location, { path: 'validationFailed' })
      if (!existingTransfer) {
        Logger.info(Util.breadcrumb(location, `callbackErrorNotFound--${AL}6`))
        await Util.commitMessageSync(kafkaTopic, consumer, message)
        message.value.to = message.value.from
        message.value.from = Enum.headers.FSPIOP.SWITCH
        const errorDescription = `${errorGenericDescription}: transfer not found`
        message.value.content.payload = Util.createPrepareErrorStatus(errorGenericCode, errorDescription, payload.extensionList)
        await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, Util.ENUMS.STATE.FAILURE, transferId)
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      } else if (headers['fspiop-source'].toLowerCase() !== existingTransfer.payeeFsp.toLowerCase()) {
        Logger.info(Util.breadcrumb(location, `callbackErrorSourceDoesntMatchPayee--${AL}7`))
        await Util.commitMessageSync(kafkaTopic, consumer, message)
        message.value.to = message.value.from
        message.value.from = Enum.headers.FSPIOP.SWITCH
        const errorDescription = `${errorGenericDescription}: header fspiop-source does not match payee fsp`
        message.value.content.payload = Util.createPrepareErrorStatus(errorGenericCode, errorDescription, payload.extensionList)
        await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, Util.ENUMS.STATE.FAILURE, transferId)
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      } else if (payload.fulfilment && !Validator.validateFulfilCondition(payload.fulfilment, existingTransfer.condition)) {
        Logger.info(Util.breadcrumb(location, `callbackErrorInvalidFulfilment--${AL}8`))
        message.value.to = message.value.from
        message.value.from = Enum.headers.FSPIOP.SWITCH
        await Util.commitMessageSync(kafkaTopic, consumer, message)
        const errorDescription = `${errorGenericDescription}: invalid fulfilment`
        message.value.content.payload = Util.createPrepareErrorStatus(errorGenericCode, errorDescription, payload.extensionList)
        await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, Util.ENUMS.STATE.FAILURE, transferId)
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      } else if (existingTransfer.transferState === TransferState.COMMITTED) {
        Logger.info(Util.breadcrumb(location, `callbackErrorModifiedRequest--${AL}9`))
        await Util.commitMessageSync(kafkaTopic, consumer, message)
        message.value.to = message.value.from
        message.value.from = Enum.headers.FSPIOP.SWITCH
        message.value.content.payload = Util.createPrepareErrorStatus(errorModifiedReqCode, errorModifiedReqDescription, payload.extensionList)
        metadataState = Util.createState(Util.ENUMS.STATE.FAILURE.status, errorModifiedReqCode, errorModifiedReqDescription)
        await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.FULFIL_DUPLICATE, message.value, metadataState, payload.transferId)
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      } else if (existingTransfer.transferState !== TransferState.RESERVED) {
        Logger.info(Util.breadcrumb(location, `callbackErrorNonReservedState--${AL}10`))
        message.value.to = message.value.from
        message.value.from = Enum.headers.FSPIOP.SWITCH
        await Util.commitMessageSync(kafkaTopic, consumer, message)
        const errorDescription = `${errorGenericDescription}: transfer state not reserved`
        message.value.content.payload = Util.createPrepareErrorStatus(errorGenericCode, errorDescription, payload.extensionList)
        metadataState = Util.createState(Util.ENUMS.STATE.FAILURE.status, errorGenericCode, errorDescription)
        await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, metadataState, transferId)
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      } else if (existingTransfer.expirationDate <= new Date()) {
        Logger.info(Util.breadcrumb(location, `callbackErrorTransferExpired--${AL}11`))
        await Util.commitMessageSync(kafkaTopic, consumer, message)
        message.value.to = message.value.from
        message.value.from = Enum.headers.FSPIOP.SWITCH
        message.value.content.payload = Util.createPrepareErrorStatus(errorTransferExpCode, errorTransferExpDescription, payload.extensionList)
        metadataState = Util.createState(Util.ENUMS.STATE.FAILURE.status, errorTransferExpCode, errorTransferExpDescription)
        await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, metadataState, transferId)
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      } else { // validations success
        Logger.info(Util.breadcrumb(location, { path: 'validationPassed' }))
        if (action === TransferEventAction.COMMIT) {
          Logger.info(Util.breadcrumb(location, `positionTopic2--${AL}12`))
          await TransferService.fulfil(transferFulfilmentId, transferId, payload)
          await Util.commitMessageSync(kafkaTopic, consumer, message)
          await Util.produceGeneralMessage(TransferEventType.POSITION, TransferEventAction.COMMIT, message.value, Util.ENUMS.STATE.SUCCESS, headers[Enum.headers.FSPIOP.DESTINATION])
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          return true
        } else {
          if (action === TransferEventAction.REJECT) {
            Logger.info(Util.breadcrumb(location, `positionTopic3--${AL}12`))
            metadataState = Util.ENUMS.STATE.SUCCESS
            await TransferService.reject(transferFulfilmentId, transferId, payload)
          } else { // action === TransferEventAction.ABORT
            Logger.info(Util.breadcrumb(location, `positionTopic4--${AL}12`))
            const abortResult = await TransferService.abort(transferId, payload, transferErrorDuplicateCheckId)
            metadataState = Util.createState(Util.ENUMS.STATE.FAILURE.status, abortResult.transferErrorRecord.errorCode, abortResult.transferErrorRecord.errorDescription)
          }
          await Util.commitMessageSync(kafkaTopic, consumer, message)
          await Util.produceGeneralMessage(TransferEventType.POSITION, action, message.value, metadataState, headers[Enum.headers.FSPIOP.DESTINATION])
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          return true
        }
      }
    } else {
      Logger.info(Util.breadcrumb(location, `callbackErrorInvalidEventAction--${AL}13`))
      await Util.commitMessageSync(kafkaTopic, consumer, message)
      message.value.to = message.value.from
      message.value.from = Enum.headers.FSPIOP.SWITCH
      message.value.content.payload = Util.createPrepareErrorStatus(errorInternalCode, errorInternalDescription, payload.extensionList)
      await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, Util.ENUMS.STATE.FAILURE, transferId)
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
  } catch (err) {
    Logger.error(`${Util.breadcrumb(location)}::${err.message}--F0`)
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    throw err
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
  const histTimerEnd = Metrics.getHistogram(
    'transfer_get',
    'Consume a get transfer message from the kafka topic and process it accordingly',
    ['success', 'fspId']
  ).startTimer()
  if (error) {
    // Logger.error(error)
    throw new Error()
  }
  let message = {}
  try {
    if (Array.isArray(messages)) {
      message = messages[0]
    } else {
      message = messages
    }
    const metadata = message.value.metadata
    const action = metadata.event.action
    const transferId = message.value.id
    const kafkaTopic = message.topic
    // let metadataState
    let consumer
    Logger.info(Util.breadcrumb(location, { method: `getTransfer:${action}` }))
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (e) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(e)
      histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    const AL = 'G'

    Util.breadcrumb(location, { path: 'validationFailed' })
    if (!await Validator.validateParticipantByName(message.value.from)) {
      Logger.info(Util.breadcrumb(location, `breakParticipantDoesntExist--${AL}1`))
      await Util.commitMessageSync(kafkaTopic, consumer, message)
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }

    // Validate if the transferId belongs the requesting fsp
    if (!await Validator.validateParticipantTransferId(message.value.from, transferId)) {
      Logger.info(Util.breadcrumb(location, `callbackErrorNotTransferParticipant--${AL}2`))
      await Util.commitMessageSync(kafkaTopic, consumer, message)

      // switch headers around and set from switch
      message.value.to = message.value.from
      message.value.from = Enum.headers.FSPIOP.SWITCH
      // set payload with error
      message.value.content.payload = Util.createPrepareErrorStatus(errorTransferIdNotFoundCode, errorTransferIdNotFoundDescription, message.value.content.payload.extensionList)
      await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventType.GET, message.value, Util.createState(Util.ENUMS.STATE.FAILURE.status, errorGenericCode, errorGenericDescription), transferId)
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }

    const transfer = await TransferService.getByIdLight(transferId)
    if (!transfer) {
      Logger.info(Util.breadcrumb(location, `callbackErrorTransferNotFound--${AL}3`))
      // switch headers around and set from switch
      message.value.to = message.value.from
      message.value.from = Enum.headers.FSPIOP.SWITCH
      // set payload with error
      message.value.content.payload = Util.createPrepareErrorStatus(errorTransferIdNotFoundCode, errorTransferIdNotFoundDescription, message.value.content.payload.extensionList)
      await Util.commitMessageSync(kafkaTopic, consumer, message)
      await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventType.GET, message.value, Util.createState(Util.ENUMS.STATE.FAILURE.status, errorGenericCode, errorGenericDescription), transferId)
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    } else {
      Util.breadcrumb(location, { path: 'validationPassed' })
      Logger.info(Util.breadcrumb(location, `callbackMessage--${AL}4`))
      // switch headers around and set from switch
      message.value.to = message.value.from
      message.value.from = Enum.headers.FSPIOP.SWITCH
      // set payload with content
      message.value.content.payload = TransferObjectTransform.toFulfil(transfer)
      await Util.commitMessageSync(kafkaTopic, consumer, message)
      // Will follow framework flow in future
      await Util.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventType.GET, message.value, Util.ENUMS.STATE.SUCCESS, transferId)
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
  } catch (err) {
    Logger.error(`${Util.breadcrumb(location)}::${err.message}--G0`)
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    throw err
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
    const prepareHandler = {
      command: prepare,
      topicName: Util.transformGeneralTopicName(TransferEventType.TRANSFER, TransferEventAction.PREPARE),
      config: Util.getKafkaConfig(Util.ENUMS.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventAction.PREPARE.toUpperCase())
    }
    prepareHandler.config.rdkafkaConf['client.id'] = prepareHandler.topicName
    await Kafka.Consumer.createHandler(prepareHandler.topicName, prepareHandler.config, prepareHandler.command)
    return true
  } catch (e) {
    Logger.error(e)
    throw e
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
      topicName: Util.transformGeneralTopicName(TransferEventType.TRANSFER, TransferEventType.FULFIL),
      config: Util.getKafkaConfig(Util.ENUMS.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventType.FULFIL.toUpperCase())
    }
    fulfillHandler.config.rdkafkaConf['client.id'] = fulfillHandler.topicName
    await Kafka.Consumer.createHandler(fulfillHandler.topicName, fulfillHandler.config, fulfillHandler.command)
    return true
  } catch (e) {
    Logger.error(e)
    throw e
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
      topicName: Util.transformGeneralTopicName(TransferEventType.TRANSFER, TransferEventType.GET),
      config: Util.getKafkaConfig(Util.ENUMS.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventType.GET.toUpperCase())
    }
    getHandler.config.rdkafkaConf['client.id'] = getHandler.topicName
    await Kafka.Consumer.createHandler(getHandler.topicName, getHandler.config, getHandler.command)
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
  } catch (e) {
    throw e
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
