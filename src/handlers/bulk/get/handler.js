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
 - Steven Oderayi <steven.oderayi@modusbox.com>
 --------------
 ******/
'use strict'

const Logger = require('../../../shared/logger').logger
const EventSdk = require('@mojaloop/event-sdk')
const Util = require('@mojaloop/central-services-shared').Util
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Producer = require('@mojaloop/central-services-stream').Util.Producer
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum
const Metrics = require('@mojaloop/central-services-metrics')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Config = require('../../../lib/config')
const BulkTransferService = require('../../../domain/bulkTransfer')
const BulkTransferModel = require('../../../models/bulkTransfer/bulkTransfer')
const Validator = require('../shared/validator')
const { ERROR_HANDLING } = require('../../../lib/config')

const location = { module: 'BulkGetHandler', method: '', path: '' }
const rethrow = require('../../../shared/rethrow')

const consumerCommit = true
const fromSwitch = true

/**
 * @function BulkGetHandler
 *
 * @async
 * @description Gets a bulk transfer by id. Gets Kafka config from default.json
 *
 * Calls createHandler to register the handler against the Stream Processing API.
 *
 * @param {error} error - error thrown if something fails within Kafka
 * @param {array} messages - a list of messages to consume for the relevant topic
 *
 * @returns {object} - Returns a boolean: true if successful, or throws an error if failed
 */
const getBulkTransfer = async (error, messages) => {
  const histTimerEnd = Metrics.getHistogram(
    'bulk_transfer_get',
    'Consume a get bulk transfer message from the kafka topic and process it accordingly',
    ['success', 'fspId']
  ).startTimer()
  if (error) {
    throw error
  }
  const message = Array.isArray(messages) ? messages[0] : messages
  const contextFromMessage = EventSdk.Tracer.extractContextFromMessage(message.value)
  const span = EventSdk.Tracer.createChildSpanFromContext('cl_bulk_transfer_get', contextFromMessage)
  try {
    await span.audit(message, EventSdk.AuditEventAction.start)
    const metadata = message.value.metadata
    const action = metadata.event.action
    const bulkTransferId = message.value.content.uriParams.id
    const kafkaTopic = message.topic
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, { method: `getBulkTransfer:${action}` }))

    const actionLetter = Enum.Events.ActionLetter.get
    const params = { message, kafkaTopic, span, consumer: Consumer, producer: Producer }
    const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action: Enum.Events.Event.Action.BULK_GET }

    Util.breadcrumb(location, { path: 'validationFailed' })

    if (!(await Validator.validateParticipantByName(message.value.from)).isValid) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `breakParticipantDoesntExist--${actionLetter}1`))
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, histTimerEnd, hubName: Config.HUB_NAME })
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    // TODO: Validate this. Is this sufficient for checking existence of bulk transfer?
    const bulkTransferLight = await BulkTransferModel.getById(bulkTransferId)
    if (!bulkTransferLight) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorBulkTransferNotFound--${actionLetter}3`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.BULK_TRANSFER_ID_NOT_FOUND, 'Provided Bulk Transfer ID was not found on the server.')
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'bulkGetGetBulkTransfer' })
    }
    // The SD says this should be 404 response which I think will not be constent with single transfers
    // which responds with CLIENT_ERROR instead
    const participants = await BulkTransferService.getParticipantsById(bulkTransferId)
    if (![participants.payeeFsp, participants.payerFsp].includes(message.value.from)) {
      Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackErrorNotBulkTransferParticipant--${actionLetter}2`))
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR)
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'bulkGetGetBulkTransfer' })
    }
    const isPayeeRequest = participants.payeeFsp === message.value.from
    Util.breadcrumb(location, { path: 'validationPassed' })
    Logger.isInfoEnabled && Logger.info(Util.breadcrumb(location, `callbackMessage--${actionLetter}4`))
    const bulkTransferResult = await BulkTransferService.getBulkTransferById(bulkTransferId)
    const bulkTransfer = isPayeeRequest ? bulkTransferResult.payeeBulkTransfer : bulkTransferResult.payerBulkTransfer
    let payload = {
      bulkTransferState: bulkTransferResult.bulkTransferStateEnumeration
    }
    let fspiopError

    if (bulkTransfer.bulkTransferState !== Enum.Transfers.BulkTransferState.PROCESSING) {
      payload = {
        ...payload,
        completedTimestamp: bulkTransfer.completedTimestamp,
        individualTransferResults: bulkTransfer.individualTransferResults,
        extensionList: bulkTransfer.extensionList
      }
    }
    message.value.content.payload = payload
    if (fspiopError) {
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(ERROR_HANDLING), eventDetail, fromSwitch, hubName: Config.HUB_NAME })
    } else {
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch, hubName: Config.HUB_NAME })
    }
    histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    return true
  } catch (err) {
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
    Logger.isErrorEnabled && Logger.error(`${Util.breadcrumb(location)}::${err.message}--G0`)
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
 * @function registerGetBulkTransferHandler
 *
 * @async
 * @description Registers the handler for bulk-transfer topic. Gets Kafka config from default.json
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerGetBulkTransferHandler = async () => {
  try {
    if (Config.MONGODB_DISABLED) {
      throw ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR,
        'Cannot register GetBulkTransferHandler as Mongo Database is disabled in configuration')
    }
    const bulkGetHandler = {
      command: getBulkTransfer,
      topicName: Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, Enum.Events.Event.Type.BULK, Enum.Events.Event.Action.GET),
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, Enum.Events.Event.Type.BULK.toUpperCase(), Enum.Events.Event.Action.GET.toUpperCase())
    }
    bulkGetHandler.config.rdkafkaConf['client.id'] = bulkGetHandler.topicName
    await Consumer.createHandler(bulkGetHandler.topicName, bulkGetHandler.config, bulkGetHandler.command)
    return true
  } catch (err) {
    rethrow.rethrowAndCountFspiopError(err, { operation: 'registerGetBulkTransferHandler' })
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
      Logger.isWarnEnabled && Logger.warn('Skipping registration of BulkGetHandler as Mongo Database is disabled in configuration')
    } else {
      await registerGetBulkTransferHandler()
    }
    return true
  } catch (err) {
    rethrow.rethrowAndCountFspiopError(err, { operation: 'registerAllHandlers' })
  }
}

module.exports = {
  getBulkTransfer,
  registerGetBulkTransferHandler,
  registerAllHandlers
}
