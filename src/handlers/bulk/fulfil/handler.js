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
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../../lib/config')
const BulkTransferModels = require('@mojaloop/object-store-lib').Models.BulkTransfer
const encodePayload = require('@mojaloop/central-services-shared').Util.StreamingProtocol.encodePayload
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const location = { module: 'BulkFulfilHandler', method: '', path: '' } // var object used as pointer
const rethrow = require('../../../shared/rethrow')
const consumerCommit = true
const fromSwitch = true

/**
 * @function BulkFulfilHandler
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
const bulkFulfil = async (error, messages) => {
  const histTimerEnd = Metrics.getHistogram(
    'transfer_bulk_fulfil',
    'Consume a bulkFulfil transfer message from the kafka topic and process it accordingly',
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
    const kafkaTopic = message.topic
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { method: 'bulkFulfil' }))
    const actionLetter = action === Enum.Events.Event.Action.BULK_COMMIT
      ? Enum.Events.ActionLetter.bulkCommit
      : (action === Enum.Events.Event.Action.BULK_ABORT
          ? Enum.Events.ActionLetter.bulkAbort
          : Enum.Events.ActionLetter.unknown)
    const params = { message, kafkaTopic, decodedPayload: payload, consumer: Consumer, producer: Producer }

    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'dupCheck' }))

    const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(bulkTransferId, payload.hash, BulkTransferService.getBulkTransferFulfilmentDuplicateCheck, BulkTransferService.saveBulkTransferFulfilmentDuplicateCheck)
    if (hasDuplicateId && hasDuplicateHash) { // TODO: handle resend :: GET /bulkTransfer
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `resend--${actionLetter}1`))
      Logger.isErrorEnabled && Logger.error(Util.breadcrumb(location, 'notImplemented'))
      return true
    }
    if (hasDuplicateId && !hasDuplicateHash) {
      Logger.isErrorEnabled && Logger.error(Util.breadcrumb(location, `callbackErrorModified--${actionLetter}2`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST)
      const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action }
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'bulkFulfil' })
    }

    // TODO: move FSPIOP-Source validation before Transfer Duplicate Check to accept only Payee's first request
    const { isValid, reasons } = await Validator.validateBulkTransferFulfilment(payload, headers)
    if (isValid) {
      let state
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { path: 'isValid' }))
      try {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, 'saveBulkTransfer'))
        if (payload.errorInformation) {
          state = await BulkTransferService.bulkFulfilError(payload, payload.errorInformation.errorDescription)
        } else {
          state = await BulkTransferService.bulkFulfil(payload)
        }
      } catch (err) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorInternal1--${actionLetter}5`))
        Logger.isErrorEnabled && Logger.error(err)

        const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err, ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
        const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action }
        params.message.value.content.uriParams = { id: bulkTransferId }

        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'bulkFulfil' })
      }
      try {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, 'individualTransferFulfils'))
        // stream initialization
        if (payload.errorInformation) {
          const bulkTransfers = await BulkTransferService.getBulkTransferById(payload.bulkTransferId)
          for (const individualTransferFulfil of bulkTransfers.payeeBulkTransfer.individualTransferResults) {
            individualTransferFulfil.errorInformation = payload.errorInformation
            await sendIndividualTransfer(
              message,
              messageId,
              kafkaTopic,
              headers,
              payload,
              state,
              params,
              individualTransferFulfil,
              histTimerEnd,
              Enum.Transfers.BulkProcessingState.PROCESSING
            )
          }
        } else {
          const IndividualTransferFulfilModel = BulkTransferModels.getIndividualTransferFulfilModel()

          // enable async/await operations for the stream
          for await (const doc of IndividualTransferFulfilModel.find({ messageId }).cursor()) {
            await sendIndividualTransfer(
              message,
              messageId,
              kafkaTopic,
              headers,
              payload,
              state,
              params,
              doc.payload,
              histTimerEnd,
              Enum.Transfers.BulkProcessingState.PROCESSING
            )
          }
        }
      } catch (err) { // TODO: handle individual transfers streaming error
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorInternal2--${actionLetter}6`))
        Logger.isErrorEnabled && Logger.error(Util.breadcrumb(location, 'notImplemented'))
        Logger.isErrorEnabled && Logger.error(err)
        return true
      }
    } else {
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
      const reasonsMessages = reasons.map(function (reason) {
        return reason.message
      })

      Logger.isErrorEnabled && Logger.error(`validationFailure Reasons - ${JSON.stringify(reasonsMessages)}`)

      try {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, 'saveInvalidRequest'))
        /**
         * TODO: Following the example for regular transfers, the following should ABORT the
         * entire bulk. CAUTION: As of 20191111 this code would also execute when failure
         * reason is "FSPIOP-Source header should match Payee". In this case we should not
         * abort the bulk as we would have accepted non-legitimate source.
         */
        const state = await BulkTransferService.bulkFulfilTransitionToAborting(payload)
        const bulkTransfers = await BulkTransferService.getBulkTransferById(payload.bulkTransferId)
        for (const individualTransferFulfil of bulkTransfers.payeeBulkTransfer.individualTransferResults) {
          individualTransferFulfil.errorInformation = validationFspiopError.toApiErrorObject().errorInformation
          // Abort-Reject all individual transfers
          // The bulk processing handler will handle informing the payer
          await sendIndividualTransfer(
            message,
            messageId,
            kafkaTopic,
            headers,
            payload,
            state,
            params,
            individualTransferFulfil,
            histTimerEnd,
            Enum.Transfers.BulkProcessingState.ABORTING
          )
        }
      } catch (err) {
        Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorInternal2--${actionLetter}7`))
        Logger.isErrorEnabled && Logger.error(err)

        const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err, ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
        const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action }
        params.message.value.content.uriParams = { id: bulkTransferId }

        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
        rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'bulkFulfil' })
      }
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorGeneric--${actionLetter}8`))

      const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action }
      params.message.value.content.uriParams = { id: bulkTransferId }

      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: validationFspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
      rethrow.rethrowAndCountFspiopError(validationFspiopError, { operation: 'bulkFulfil' })
    }
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(`${Util.breadcrumb(location)}::${err.message}--BP0`)
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    rethrow.rethrowAndCountFspiopError(err, { operation: 'bulkFulfil' })
  }
}

/**
 * @function sendIndividualTransfer
 *
 * @async
 * @description sends individual transfers to the fulfil handler
 */
const sendIndividualTransfer = async (message, messageId, kafkaTopic, headers, payload, state, params, individualTransferFulfil, histTimerEnd, bulkProcessingStateId) => {
  const transferId = individualTransferFulfil.transferId
  delete individualTransferFulfil.transferId
  const bulkTransferAssociationRecord = {
    transferId,
    bulkTransferId: payload.bulkTransferId,
    bulkProcessingStateId,
    errorCode: payload.errorInformation ? payload.errorInformation.errorCode : undefined,
    errorDescription: payload.errorInformation ? payload.errorInformation.errorDescription : undefined
  }
  await BulkTransferService.bulkTransferAssociationUpdate(transferId, payload.bulkTransferId, bulkTransferAssociationRecord)

  let eventDetail
  if (state === Enum.Transfers.BulkTransferState.INVALID ||
    individualTransferFulfil.errorInformation ||
    !individualTransferFulfil.fulfilment) {
    individualTransferFulfil.transferState = Enum.Transfers.TransferState.ABORTED
    eventDetail = { functionality: Enum.Events.Event.Type.FULFIL, action: Enum.Events.Event.Action.BULK_ABORT }
  } else {
    individualTransferFulfil.transferState = Enum.Transfers.TransferState.COMMITTED
    eventDetail = { functionality: Enum.Events.Event.Type.FULFIL, action: Enum.Events.Event.Action.BULK_COMMIT }
  }
  const dataUri = encodePayload(JSON.stringify(individualTransferFulfil), headers[Enum.Http.Headers.GENERAL.CONTENT_TYPE.value])
  const metadata = Util.StreamingProtocol.createMetadataWithCorrelatedEventState(message.value.metadata.event.id, Enum.Events.Event.Type.FULFIL, Enum.Events.Event.Action.COMMIT, Enum.Events.EventStatus.SUCCESS.status, Enum.Events.EventStatus.SUCCESS.code, Enum.Events.EventStatus.SUCCESS.description) // TODO: switch action to 'bulk-fulfil' flow
  const msg = {
    value: Util.StreamingProtocol.createMessage(messageId, headers[Enum.Http.Headers.FSPIOP.DESTINATION], headers[Enum.Http.Headers.FSPIOP.SOURCE], metadata, headers, dataUri, { id: transferId })
  }
  params = { message: msg, kafkaTopic, consumer: Consumer, producer: Producer }
  await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, histTimerEnd, eventDetail, hubName: Config.HUB_NAME })
  histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
}

/**
 * @function registerBulkFulfilHandler
 *
 * @async
 * @description Registers the handler for bulk-transfer topic. Gets Kafka config from default.json
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerBulkFulfilHandler = async () => {
  try {
    if (Config.MONGODB_DISABLED) {
      throw ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR,
        'Cannot register BulkFulfilHandler as Mongo Database is disabled in configuration')
    }
    const bulkFulfilHandler = {
      command: bulkFulfil,
      topicName: Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, Enum.Events.Event.Type.BULK, Enum.Events.Event.Action.FULFIL),
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, Enum.Events.Event.Type.BULK.toUpperCase(), Enum.Events.Event.Action.FULFIL.toUpperCase())
    }
    bulkFulfilHandler.config.rdkafkaConf['client.id'] = bulkFulfilHandler.topicName
    await Consumer.createHandler(bulkFulfilHandler.topicName, bulkFulfilHandler.config, bulkFulfilHandler.command)
    return true
  } catch (err) {
    rethrow.rethrowAndCountFspiopError(err, { operation: 'registerBulkFulfilHandler' })
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
      Logger.isWarnEnabled && Logger.warn('Skipping registration of BulkFulfilHandler as Mongo Database is disabled in configuration')
    } else {
      await registerBulkFulfilHandler()
    }
    return true
  } catch (err) {
    rethrow.rethrowAndCountFspiopError(err, { operation: 'registerAllHandlers' })
  }
}

module.exports = {
  bulkFulfil,
  registerBulkFulfilHandler,
  registerAllHandlers
}
