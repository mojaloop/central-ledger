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
 - Valentin Genev <valentin.genev@modusbox.com>
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/
'use strict'

const Logger = require('../../../shared/logger').logger
const BulkTransferService = require('../../../domain/bulkTransfer')
const Util = require('@mojaloop/central-services-shared').Util
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Producer = require('@mojaloop/central-services-stream').Util.Producer
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Validator = require('../shared/validator')
const Enum = require('@mojaloop/central-services-shared').Enum
const TransferEventAction = Enum.Events.Event.Action
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../../lib/config')
const BulkTransferModels = require('@mojaloop/object-store-lib').Models.BulkTransfer
const encodePayload = require('@mojaloop/central-services-shared').Util.StreamingProtocol.encodePayload
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const location = { module: 'BulkPrepareHandler', method: '', path: '' } // var object used as pointer
const rethrow = require('../../../shared/rethrow')
const consumerCommit = true
const fromSwitch = true

const getBulkMessage = async (bulkTransferId) => {
  const BulkTransferModel = BulkTransferModels.getBulkTransferModel()
  const message = await BulkTransferModel.findOne({ bulkTransferId }, '-_id -individualTransfersIds')
  return message.toJSON()
}

/**
 * @function BulkPrepareHandler
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
const bulkPrepare = async (error, messages) => {
  const histTimerEnd = Metrics.getHistogram(
    'transfer_bulk_prepare',
    'Consume a bulkPrepare transfer message from the kafka topic and process it accordingly',
    ['success', 'fspId']
  ).startTimer()
  if (error) {
    throw error
  }
  let message = {}
  try {
    if (Array.isArray(messages)) {
      message = messages[0]
    } else {
      message = messages
    }
    const messageId = message.value.id
    const payload = message.value.content.payload
    const headers = message.value.content.headers
    const action = message.value.metadata.event.action
    const bulkTransferId = payload.bulkTransferId
    const bulkTransferHash = payload.hash
    const kafkaTopic = message.topic

    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { method: 'bulkPrepare' }))

    const actionLetter = action === Enum.Events.Event.Action.BULK_PREPARE ? Enum.Events.ActionLetter.bulkPrepare : Enum.Events.ActionLetter.unknown
    let params = { message, kafkaTopic, decodedPayload: payload, consumer: Consumer, producer: Producer }

    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'dupCheck' }))

    const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(bulkTransferId, bulkTransferHash, BulkTransferService.getBulkTransferDuplicateCheck, BulkTransferService.saveBulkTransferDuplicateCheck, {
      hashOverride: true
    })

    if (hasDuplicateId && hasDuplicateHash) {
      const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action: TransferEventAction.BULK_PREPARE_DUPLICATE }
      const bulkTransferResult = await BulkTransferService.getBulkTransferById(bulkTransferId)
      const bulkTransfer = bulkTransferResult.payerBulkTransfer
      const transferStateEnum = bulkTransfer && bulkTransfer.bulkTransferState
      if ([
        Enum.Transfers.BulkTransferState.COMPLETED,
        Enum.Transfers.BulkTransferState.REJECTED,
        Enum.Transfers.BulkTransferState.EXPIRED
      ].includes(transferStateEnum)) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, 'finalized'))
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callback--${actionLetter}2`))

        let payload = {
          bulkTransferState: bulkTransfer.bulkTransferState
        }
        let fspiopError

        if (bulkTransfer.bulkTransferState === Enum.Transfers.BulkTransferState.REJECTED) {
          payload = {
            errorInformation: bulkTransfer.individualTransferResults[0].errorInformation
          }
          fspiopError = ErrorHandler.Factory.createFSPIOPErrorFromErrorInformation(payload.errorInformation)
        } else {
          payload = {
            ...payload,
            completedTimestamp: bulkTransfer.completedTimestamp,
            individualTransferResults: bulkTransfer.individualTransferResults,
            extensionList: bulkTransfer.extensionList
          }
        }

        params.message.value.content.payload = payload
        params.message.value.content.uriParams = { id: bulkTransferId }
        if (fspiopError) {
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        } else {
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        }
        return true
      } else {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, 'inProgress'))
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `ignore--${actionLetter}3`))
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, hubName: Config.HUB_NAME })
        return true
      }
    }

    if (hasDuplicateId && !hasDuplicateHash) { // handle modified request and produce error callback to payer
      Logger.isErrorEnabled && Logger.error(Util.breadcrumb(location, `callbackErrorModified--${actionLetter}4`))

      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST)
      const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action }
      params.message.value.content.uriParams = { id: bulkTransferId }

      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'bulkPrepare' })
    }

    const { isValid, reasons, payerParticipantId, payeeParticipantId } = await Validator.validateBulkTransfer(payload, headers)
    if (isValid) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'isValid' }))
      try {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, 'saveBulkTransfer'))
        const participants = { payerParticipantId, payeeParticipantId }
        await BulkTransferService.bulkPrepare(payload, participants)
      } catch (err) { // handle insert error and produce error callback to payer
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorInternal1--${actionLetter}5`))

        const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err, ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
        const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action }
        params.message.value.content.uriParams = { id: bulkTransferId }

        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'bulkPrepare' })
      }
      try {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, 'individualTransfers'))

        const IndividualTransferModel = BulkTransferModels.getIndividualTransferModel()

        // for loop on a stream cursor
        for await (const doc of IndividualTransferModel.find({ messageId }).cursor()) {
          const individualTransfer = doc.payload
          individualTransfer.payerFsp = payload.payerFsp
          individualTransfer.payeeFsp = payload.payeeFsp
          individualTransfer.amount = individualTransfer.transferAmount
          delete individualTransfer.transferAmount
          individualTransfer.expiration = payload.expiration
          const bulkTransferAssociationRecord = {
            transferId: individualTransfer.transferId,
            bulkTransferId: payload.bulkTransferId,
            bulkProcessingStateId: Enum.Transfers.BulkProcessingState.RECEIVED
          }
          await BulkTransferService.bulkTransferAssociationCreate(bulkTransferAssociationRecord)
          const dataUri = encodePayload(JSON.stringify(individualTransfer), headers[Enum.Http.Headers.GENERAL.CONTENT_TYPE.value])
          const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEventState(message.value.metadata.event.id, Enum.Events.Event.Type.TRANSFER, Enum.Events.Event.Action.BULK_PREPARE, Enum.Events.EventStatus.SUCCESS.status, Enum.Events.EventStatus.SUCCESS.code, Enum.Events.EventStatus.SUCCESS.description)
          const msg = {
            value: Util.StreamingProtocol.createMessage(messageId, headers[Enum.Http.Headers.FSPIOP.DESTINATION], headers[Enum.Http.Headers.FSPIOP.SOURCE], metadata, headers, dataUri)
          }
          params = { message: msg, kafkaTopic, consumer: Consumer, producer: Producer }
          const eventDetail = { functionality: Enum.Events.Event.Type.PREPARE, action: Enum.Events.Event.Action.BULK_PREPARE }
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, hubName: Config.HUB_NAME })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        }
      } catch (err) { // handle individual transfers streaming error
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorInternal2--${actionLetter}6`))
        const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err, ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
        const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action }
        params.message.value.content.uriParams = { id: bulkTransferId }

        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'bulkPrepare' })
      }
    } else { // handle validation failure
      Logger.isErrorEnabled && Logger.error(Util.breadcrumb(location, { path: 'validationFailed' }))
      const validationFspiopError = reasons.shift()
      if (reasons.length > 0) {
        validationFspiopError.extensions = []
        // If there are multiple validation errors attach them as extensions
        // to the first error
        reasons.forEach((reason, i) => {
          validationFspiopError.extensions.push({
            key: `additionalErrors${i}`,
            value: reason.message
          })
        })
      }
      // Converting FSPIOPErrors to strings is verbose, so we reduce the errors
      // to just their message.
      // `bulkTransferStateChange.reason` also has a 512 character limit.
      const reasonsMessages = reasons.map(function (reason) {
        return reason.message
      })
      Logger.isErrorEnabled && Logger.error(`validationFailure Reasons - ${JSON.stringify(reasonsMessages)}`)

      try { // save invalid request for auditing
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, 'saveInvalidRequest'))
        await BulkTransferService.bulkPrepare(payload, { payerParticipantId, payeeParticipantId }, reasonsMessages.toString(), false)
      } catch (err) { // handle insert error and produce error callback notification to payer
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorInternal2--${actionLetter}6`))
        Logger.isErrorEnabled && Logger.error(err)

        const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err, ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
        const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action }
        params.message.value.content.uriParams = { id: bulkTransferId }

        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'bulkPrepare' })
      }
      // produce validation error callback notification to payer
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorGeneric--${actionLetter}7`))

      const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action }
      params.message.value.content.uriParams = { id: bulkTransferId }

      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: validationFspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
      rethrow.rethrowAndCountFspiopError(validationFspiopError, { operation: 'bulkPrepare' })
    }
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(`${Util.breadcrumb(location)}::${err.message}--BP0`)
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    rethrow.rethrowAndCountFspiopError(err, { operation: 'bulkPrepare' })
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
    if (Config.MONGODB_DISABLED) {
      throw ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR,
        'Cannot register BulkPrepareHandler as Mongo Database is disabled in configuration')
    }
    const bulkPrepareHandler = {
      command: bulkPrepare,
      topicName: Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, Enum.Events.Event.Type.BULK, Enum.Events.Event.Action.PREPARE),
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, Enum.Events.Event.Type.BULK.toUpperCase(), Enum.Events.Event.Action.PREPARE.toUpperCase())
    }
    bulkPrepareHandler.config.rdkafkaConf['client.id'] = bulkPrepareHandler.topicName
    await Consumer.createHandler(bulkPrepareHandler.topicName, bulkPrepareHandler.config, bulkPrepareHandler.command)
    return true
  } catch (err) {
    rethrow.rethrowAndCountFspiopError(err, { operation: 'registerBulkPrepareHandler' })
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
    // Lets check if MongoDB is disabled, and print a warning that we are unable to register the handler.
    // This can only happen if you are running all Central-Ledger's services as a single mono-app which is ok for development purposes.
    if (Config.MONGODB_DISABLED) {
      Logger.isWarnEnabled && Logger.warn('Skipping registration of BulkPrepareHandler as Mongo Database is disabled in configuration')
    } else {
      await registerBulkPrepareHandler()
    }
    return true
  } catch (err) {
    rethrow.rethrowAndCountFspiopError(err, { operation: 'registerAllHandlers' })
  }
}

module.exports = {
  bulkPrepare,
  getBulkMessage,
  registerBulkPrepareHandler,
  registerAllHandlers
}
