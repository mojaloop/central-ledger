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

const PREPARE_DUPLICATE_INSERT_MODE = process.env.PREPARE_DUPLICATE_INSERT_MODE
const PREPARE_SEND_POSITION_TO_KAFKA = !(process.env.PREPARE_SEND_POSITION_TO_KAFKA_DISABLED === 'true')

// ### START: PERF_TEST kafka.proceed
const { proceedToPosition } = require('../../../test/perf/src/util/prepare')
// PERF_TEST

// ### START: Placeholder for modifing Comparators.duplicateCheckComparator algorithm to use an insert only method for duplicate checking
const Crypto = require('crypto') // copied from @mojaloop/central-services-shared/src/util/hash.js <- to be removed once duplicate-check algorithm test changes are reverted, or made permanent.
function generateSha256 (object) { // copied from @mojaloop/central-services-shared/src/util/hash.js
  const hashSha256 = Crypto.createHash('sha256')
  let hash = JSON.stringify(object)
  hash = hashSha256.update(hash)
  // remove trailing '=' as per specification
  hash = hashSha256.digest(hash).toString('base64').slice(0, -1)
  return hash
}
// ### END: Placeholder for modifing Comparators.duplicateCheckComparator algorithm to use an insert only method for duplicate checking



const consumerCommit = false
const fromSwitch = true
const toDestination = true



/**
 * @function TransferPreparePositionHandler
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
const preparePosition = async (error, messages) => {
  const location = { module: 'PreparePositionHandler', method: '', path: '' }
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
        : Enum.Events.ActionLetter.unknown)

    let functionality = action === TransferEventAction.PREPARE ? TransferEventType.NOTIFICATION
      : (action === TransferEventAction.BULK_PREPARE ? TransferEventType.BULK_PROCESSING
        : Enum.Events.ActionLetter.unknown)

    const params = { message, kafkaTopic, decodedPayload: payload, span, consumer: Consumer, producer: Producer }

    Logger.info(Util.breadcrumb(location, { path: 'dupCheck' }))
    const histTimerDuplicateCheckEnd = Metrics.getHistogram(
      'handler_transfers',
      'prepare_duplicateCheckComparator - Metrics for transfer handler',
      ['success', 'funcName', 'mode']
    ).startTimer()

    // ### Following has been commented out to test the Insert only algorithm for duplicate-checks
    // const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(transferId, payload, TransferService.getTransferDuplicateCheck, TransferService.saveTransferDuplicateCheck)
    let { hasDuplicateId, hasDuplicateHash } = { hasDuplicateId: true, hasDuplicateHash: true } // lets assume the worst case
    let prepare_duplicateCheckComparator_mode = 'UNDEFINED'

    //only support the insert only duplicate check mode
    prepare_duplicateCheckComparator_mode = 'INSERT_ONLY'
    // Logger.warn(`PREPARE_ENABLED_DUPLCIATE_INSERT_ONLY=${PREPARE_ENABLED_DUPLCIATE_INSERT_ONLY} - YES`)
    // ### START: Placeholder for modifing Comparators.duplicateCheckComparator algorithm to use an insert only method for duplicate checking
    const generatedHash = generateSha256(payload) // modified from @mojaloop/central-services-shared/src/util/comparators/duplicateCheckComparator.js
    try {
      await TransferService.saveTransferDuplicateCheck(transferId, generatedHash) // modified from @mojaloop/central-services-shared/src/util/comparators/duplicateCheckComparator.js
      hasDuplicateId = false // overriding results to golden path successful use-case only for testing purposes
      hasDuplicateHash = false // overriding results to golden path successful use-case only for testing purposes
    } catch (err) {
      Logger.error(err)
      hasDuplicateId = true // overriding results to false in the advent there is any errors since we cant have duplicate transferIds
      hasDuplicateHash = false // overriding results to false in the advent there is any errors since we have not compared against any existing hashes
    }

    histTimerDuplicateCheckEnd({ success: true, funcName: 'prepare_duplicateCheckComparator', mode: prepare_duplicateCheckComparator_mode })

      //Logger.info(Util.breadcrumb(location, `positionTopic1--${actionLetter}7`))

    if (hasDuplicateId || hasDuplicateHash) {
      //duplicate handling not supported in happy path only combined handler
      Logger.error(`Duplicate handling not supported in happy path only combined handler for transfer ${transferId}`);
      return
    } else { // !hasDuplicateId
      // happy path enters here...
      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)

      if (!validationPassed) {
        Logger.error(Util.breadcrumb(location, { path: 'validationFailed' }))
        Logger.error(`validation failures not supported in combined handler for transfer ${transferId}`)
        Logger.error(`Validation failures: ${util.inspect(reasons)}`)
        return
      }

      Logger.info(Util.breadcrumb(location, { path: 'validationPassed' }))

      try {
        Logger.info(Util.breadcrumb(location, 'saveTransfer-PreparePosition'))

        //write the transfer to the DB...AND attempt payer dfsp position adjustment at the same time
        //note that this is an optimisation to the previous architecture where we broke prepare and position
        //into two steps. Here we do both in one operation
        await TransferService.preparePosition(payload)
      } catch (err) {
        Logger.info(Util.breadcrumb(location, `callbackErrorInternal1--${actionLetter}6`))
        Logger.error(`${Util.breadcrumb(location)}::${err.message}`)
        Logger.error(`transfer save failures not handled in combined handler for transfer ${transferId}`)
      }

      //next step is prepare->notification (notification to payee dfsp for prepare)
      functionality = Enum.Events.Event.Type.NOTIFICATION
      const eventDetail = { functionality, action: TransferEventAction.PREPARE }

      //proceed...note that we are now effectively at the end of the old position handler...
      //wo we proceed as if we completed position...this should result in a notification, which
      //is a forward of the prepare to the payee dfsp.
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, toDestination })

      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
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
