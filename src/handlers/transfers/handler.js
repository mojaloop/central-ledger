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
const TET = Enum.transferEventType
const TEA = Enum.transferEventAction
const TransferObjectTransform = require('../../domain/transfer/transform')
const Errors = require('../../lib/errors')
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../lib/config')
const Uuid = require('uuid4')

const eEnum = {
  internal: 2001,
  generic: 3100,
  modifiedRequest: 3106,
  transferExpired: 3300,
  transferNotFound: 3208
}
const location = { module: 'PrepareHandler', method: '', path: '' } // var object used as pointer
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
    const action = message.value.metadata.event.action
    const transferId = payload.transferId
    const kafkaTopic = message.topic
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
    const AL = action === TEA.PREPARE ? 'P' : '?'
    let params = { message, transferId, kafkaTopic, consumer }

    Logger.info(Util.breadcrumb(location, { path: 'dupCheck' }))
    const { existsMatching, existsNotMatching } = await TransferService.validateDuplicateHash(transferId, payload)
    if (existsMatching) {
      Logger.info(Util.breadcrumb(location, `existsMatching`))
      const transferState = await TransferService.getTransferStateChange(transferId)
      const transferStateEnum = transferState && transferState.enumeration
      if (!transferState) {
        Logger.error(Util.breadcrumb(location, `callbackErrorNotFound1--${AL}1`))
        const errorInformation = Errors.getErrorInformation(eEnum.internal, 'transfer/state not found')
        const producer = { functionality: TET.NOTIFICATION, action: TEA.PREPARE }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
      } else if (transferStateEnum === TransferStateEnum.COMMITTED || transferStateEnum === TransferStateEnum.ABORTED) {
        Logger.info(Util.breadcrumb(location, `callbackFinilized1--${AL}2`))
        let record = await TransferService.getById(transferId)
        message.value.content.payload = TransferObjectTransform.toFulfil(record)
        const producer = { functionality: TET.NOTIFICATION, action: TEA.PREPARE_DUPLICATE }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, producer, fromSwitch }) // TODO: verify fromSwitch
      } else if (transferStateEnum === TransferStateEnum.RECEIVED || transferStateEnum === TransferStateEnum.RESERVED) {
        Logger.info(Util.breadcrumb(location, `inProgress1--${AL}3`))
        return await Util.proceed(params, { consumerCommit, histTimerEnd })
      }
    }
    if (existsNotMatching) {
      Logger.error(Util.breadcrumb(location, `callbackErrorModified1--${AL}4`))
      const errorInformation = Errors.getErrorInformation(eEnum.modifiedRequest)
      const producer = { functionality: TET.NOTIFICATION, action: TEA.PREPARE }
      return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch }) // TODO: verify fromSwitch
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
        const errorInformation = Errors.getErrorInformation(eEnum.internal)
        const producer = { functionality: TET.NOTIFICATION, action: TEA.PREPARE }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch }) // TODO: verify fromSwitch
      }
      Logger.info(Util.breadcrumb(location, `positionTopic1--${AL}6`))
      const producer = { functionality: TET.POSITION, action: TEA.PREPARE }
      return await Util.proceed(params, { consumerCommit, histTimerEnd, producer, toDestination })
    } else {
      Logger.error(Util.breadcrumb(location, { path: 'validationFailed' }))
      try {
        Logger.info(Util.breadcrumb(location, `saveInvalidRequest`))
        await TransferService.prepare(payload, reasons.toString(), false)
      } catch (err) {
        Logger.info(Util.breadcrumb(location, `callbackErrorInternal2--${AL}7`))
        Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
        const errorInformation = Errors.getErrorInformation(eEnum.internal)
        const producer = { functionality: TET.NOTIFICATION, action: TEA.PREPARE }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
      }
      Logger.info(Util.breadcrumb(location, `callbackErrorGeneric--${AL}8`))
      await TransferService.logTransferError(transferId, eEnum.generic, reasons.toString())
      const errorInformation = Errors.getErrorInformation(eEnum.generic, reasons.toString())
      const producer = { functionality: TET.NOTIFICATION, action: TEA.PREPARE }
      return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
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
    const action = message.value.metadata.event.action
    const transferId = message.value.id
    const kafkaTopic = message.topic
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
    const AL = action === TEA.COMMIT ? 'C' : (action === TEA.REJECT ? 'R' : (action === TEA.ABORT ? 'A' : '?'))
    // fulfil-specific declarations
    const isTransferError = action === TEA.ABORT
    const transferFulfilmentId = Uuid()
    let params = { message, transferId, kafkaTopic, consumer }

    Logger.info(Util.breadcrumb(location, { path: 'dupCheck' }))
    const { existsMatching, existsNotMatching, isValid, transferErrorDuplicateCheckId } =
      await TransferService.validateDuplicateHash(transferId, payload, transferFulfilmentId, isTransferError)

    if (existsMatching) {
      Logger.info(Util.breadcrumb(location, `existsMatching`))
      const transferState = await TransferService.getTransferStateChange(transferId)
      const transferStateEnum = transferState && transferState.enumeration
      if (!transferState) {
        Logger.error(Util.breadcrumb(location, `callbackErrorNotFound2--${AL}1`))
        const errorInformation = Errors.getErrorInformation(eEnum.internal, 'transfer/state not found')
        const producer = { functionality: TET.NOTIFICATION, action: TEA.COMMIT }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
      } else if (transferStateEnum === TransferStateEnum.COMMITTED || transferStateEnum === TransferStateEnum.ABORTED) {
        if (!isTransferError) {
          if (isValid) {
            Logger.info(Util.breadcrumb(location, `callbackFinilized2--${AL}2`))
            let record = await TransferService.getById(transferId)
            message.value.content.payload = TransferObjectTransform.toFulfil(record)
            const producer = { functionality: TET.NOTIFICATION, action: TEA.FULFIL_DUPLICATE }
            return await Util.proceed(params, { consumerCommit, histTimerEnd, producer, fromSwitch })
          } else {
            Logger.info(Util.breadcrumb(location, `callbackErrorModified2--${AL}3`))
            const errorInformation = Errors.getErrorInformation(eEnum.modifiedRequest)
            const producer = { functionality: TET.NOTIFICATION, action: TEA.FULFIL_DUPLICATE }
            return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
          }
        } else {
          if (isValid) {
            Logger.info(Util.breadcrumb(location, `break--${AL}2`))
            return await Util.proceed(params, { consumerCommit, histTimerEnd })
          } else {
            Logger.info(Util.breadcrumb(location, `breakModified1--${AL}3`))
            return await Util.proceed(params, { consumerCommit, histTimerEnd })
          }
        }
      } else if (transferStateEnum === TransferStateEnum.RECEIVED || transferStateEnum === TransferStateEnum.RESERVED) {
        Logger.info(Util.breadcrumb(location, `inProgress2--${AL}4`))
        await Util.proceed(params, { consumerCommit, histTimerEnd })
      }
    }
    if (existsNotMatching) {
      Logger.info(Util.breadcrumb(location, `existsNotMatching`))
      if (!isTransferError) {
        Logger.info(Util.breadcrumb(location, `inProgress3--${AL}5`))
      } else {
        Logger.info(Util.breadcrumb(location, `breakModified2--${AL}5`))
        return await Util.proceed(params, { consumerCommit, histTimerEnd })
      }
    }

    if (message.value.metadata.event.type === TET.FULFIL && [TEA.COMMIT, TEA.REJECT, TEA.ABORT].includes(action)) {
      const fspiopSource = Enum.headers.FSPIOP.SOURCE
      const existingTransfer = await TransferService.getById(transferId)
      Util.breadcrumb(location, { path: 'validationFailed' })
      if (!existingTransfer) {
        Logger.info(Util.breadcrumb(location, `callbackErrorNotFound--${AL}6`))
        const errorInformation = Errors.getErrorInformation(eEnum.generic, 'transfer not found')
        const producer = { functionality: TET.NOTIFICATION, action: TEA.COMMIT }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
      } else if (headers[fspiopSource].toLowerCase() !== existingTransfer.payeeFsp.toLowerCase()) {
        Logger.info(Util.breadcrumb(location, `callbackErrorSourceDoesntMatchPayee--${AL}7`))
        const errorInformation = Errors.getErrorInformation(eEnum.generic, `${fspiopSource} does not match payee fsp`)
        const producer = { functionality: TET.NOTIFICATION, action: TEA.COMMIT }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
      } else if (payload.fulfilment && !Validator.validateFulfilCondition(payload.fulfilment, existingTransfer.condition)) {
        Logger.info(Util.breadcrumb(location, `callbackErrorInvalidFulfilment--${AL}8`))
        const errorInformation = Errors.getErrorInformation(eEnum.generic, 'invalid fulfilment')
        const producer = { functionality: TET.NOTIFICATION, action: TEA.COMMIT }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
      } else if (existingTransfer.transferState === TransferState.COMMITTED) {
        Logger.info(Util.breadcrumb(location, `callbackErrorModifiedRequest--${AL}9`))
        const errorInformation = Errors.getErrorInformation(eEnum.modifiedRequest)
        const producer = { functionality: TET.NOTIFICATION, action: TEA.FULFIL_DUPLICATE }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
      } else if (existingTransfer.transferState !== TransferState.RESERVED) {
        Logger.info(Util.breadcrumb(location, `callbackErrorNonReservedState--${AL}10`))
        const errorInformation = Errors.getErrorInformation(eEnum.generic, 'transfer state not reserved')
        const producer = { functionality: TET.NOTIFICATION, action: TEA.COMMIT }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
      } else if (existingTransfer.expirationDate <= new Date()) {
        Logger.info(Util.breadcrumb(location, `callbackErrorTransferExpired--${AL}11`))
        const errorInformation = Errors.getErrorInformation(eEnum.transferExpired)
        const producer = { functionality: TET.NOTIFICATION, action: TEA.COMMIT }
        return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
      } else { // validations success
        Logger.info(Util.breadcrumb(location, { path: 'validationPassed' }))
        if (action === TEA.COMMIT) {
          Logger.info(Util.breadcrumb(location, `positionTopic2--${AL}12`))
          await TransferService.fulfil(transferFulfilmentId, transferId, payload)
          const producer = { functionality: TET.POSITION, action: TEA.COMMIT }
          return await Util.proceed(params, { consumerCommit, histTimerEnd, producer, toDestination })
        } else {
          if (action === TEA.REJECT) {
            Logger.info(Util.breadcrumb(location, `positionTopic3--${AL}12`))
            await TransferService.reject(transferFulfilmentId, transferId, payload)
            const producer = { functionality: TET.POSITION, action: TEA.REJECT }
            return await Util.proceed(params, { consumerCommit, histTimerEnd, producer, toDestination })
          } else { // action === TEA.ABORT
            Logger.info(Util.breadcrumb(location, `positionTopic4--${AL}12`))
            const abortResult = await TransferService.abort(transferId, payload, transferErrorDuplicateCheckId)
            const TER = abortResult.transferErrorRecord
            const producer = { functionality: TET.POSITION, action: TEA.ABORT }
            const errorInformation = Errors.getErrorInformation(TER.errorCode, { replace: TER.errorDescription })
            return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, toDestination })
          }
        }
      }
    } else {
      Logger.info(Util.breadcrumb(location, `callbackErrorInvalidEventAction--${AL}13`))
      const errorInformation = Errors.getErrorInformation(eEnum.internal)
      const producer = { functionality: TET.NOTIFICATION, action: TEA.COMMIT }
      return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
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
    let params = { message, transferId, kafkaTopic, consumer }
    const producer = { functionality: TET.NOTIFICATION, action: TEA.GET }

    Util.breadcrumb(location, { path: 'validationFailed' })
    if (!await Validator.validateParticipantByName(message.value.from)) {
      Logger.info(Util.breadcrumb(location, `breakParticipantDoesntExist--${AL}1`))
      return await Util.proceed(params, { consumerCommit, histTimerEnd })
    }
    if (!await Validator.validateParticipantTransferId(message.value.from, transferId)) {
      Logger.info(Util.breadcrumb(location, `callbackErrorNotTransferParticipant--${AL}2`))
      const errorInformation = Errors.getErrorInformation(eEnum.transferNotFound) // TODO: inappropriate error message
      return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
    }

    const transfer = await TransferService.getByIdLight(transferId)
    if (!transfer) { // TODO: cannot be triggered as callbackErrorNotTransferParticipant comes first
      Logger.info(Util.breadcrumb(location, `callbackErrorTransferNotFound--${AL}3`))
      const errorInformation = Errors.getErrorInformation(eEnum.transferNotFound)
      return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
    } else {
      Util.breadcrumb(location, { path: 'validationPassed' })
      Logger.info(Util.breadcrumb(location, `callbackMessage--${AL}4`))
      message.value.content.payload = TransferObjectTransform.toFulfil(transfer)
      return await Util.proceed(params, { consumerCommit, histTimerEnd, producer, fromSwitch })
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
      topicName: Util.transformGeneralTopicName(TET.TRANSFER, TEA.PREPARE),
      config: Util.getKafkaConfig(Util.ENUMS.CONSUMER, TET.TRANSFER.toUpperCase(), TEA.PREPARE.toUpperCase())
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
      topicName: Util.transformGeneralTopicName(TET.TRANSFER, TET.FULFIL),
      config: Util.getKafkaConfig(Util.ENUMS.CONSUMER, TET.TRANSFER.toUpperCase(), TET.FULFIL.toUpperCase())
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
      topicName: Util.transformGeneralTopicName(TET.TRANSFER, TET.GET),
      config: Util.getKafkaConfig(Util.ENUMS.CONSUMER, TET.TRANSFER.toUpperCase(), TET.GET.toUpperCase())
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
