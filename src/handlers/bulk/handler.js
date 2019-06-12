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
const aw = require('awaitify-stream')
const Uuid = require('uuid4')
const Util = require('../lib/utility')
const Kafka = require('../lib/kafka')
const Enum = require('../../lib/enum')
// const TransferState = Enum.TransferState
// const TransferStateEnum = Enum.TransferStateEnum
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction
// const Errors = require('../../lib/errors')
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../lib/config')

// const errorType = Errors.errorType
const location = { module: 'BulkPrepareHandler', method: '', path: '' } // var object used as pointer
const consumerCommit = true
// const fromSwitch = true
const toDestination = true

const BULK = 'bulk'
const PREPARE = 'prepare'
const { IndividualTransferModel, BulkTransferModel } = require('./bulkModels')
const Mongoose = require('../../lib/mongodb').Mongoose

const connectMongoose = async () => {
  let db = await Mongoose.connect(`mongodb://localhost:27017/bulk_transfers`, { // TODO needs config for connection string
    promiseLibrary: global.Promise
  })
  return db
}

const getBulkMessage = async (bulkTransferId) => {
  let message = await BulkTransferModel.findOne({ bulkTransferId }, '-_id -individualTransfersIds')
  return message.toJSON()
}

const processBulkMessageAsStream = async (error, messages) => {
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
    let { bulkTransferId } = message.value.content.payload
    let headers = message.value.content.headers
    const kafkaTopic = (message && message.topic)
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
    let indvidualTransfersStream = IndividualTransferModel.find({ bulkTransferId }).cursor() // initialize the stream
    let reader = aw.createReader(indvidualTransfersStream) // to be able to use the stream with async/await operations (like await for commit in the util.proceed the aw is used to wrap the stream)
    let doc
    while ((doc = await reader.readAsync()) !== null) {
      const msg = {
        value: {
          id: doc.payload.transferId,
          from: doc.payload.payerFsp,
          to: doc.payload.payeeFsp,
          type: 'application/json',
          content: {
            headers,
            payload: doc.dataUri
          },
          metadata: {
            event: {
              id: Uuid(),
              responseTo: 'dfa',
              type: 'bulk-prepare',
              action: 'prepare',
              createdAt: new Date(),
              state: {
                status: 'success',
                code: 0
              }
            }
          }
        }
      }
      Logger.info(`Transfer::prepare::Produce message ${JSON.stringify(msg)}`)
      let params = { message: msg, bulkTransferId, kafkaTopic, consumer }
      const producer = { functionality: TransferEventType.TRANSFER, action: TransferEventAction.PREPARE }
      await Util.proceed(params, { consumerCommit, histTimerEnd, producer, toDestination })
    }
  } catch (e) {
    Logger.error(`Error processing the message - ${e}`)
    throw e
  }
}

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
    await connectMongoose()
    const bulkPrepareHandler = {
      command: processBulkMessageAsStream,
      topicName: Util.transformGeneralTopicName(BULK.toLowerCase(), PREPARE.toLowerCase()),
      config: Util.getKafkaConfig(Util.ENUMS.CONSUMER, BULK.toUpperCase(), PREPARE.toUpperCase())
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
  registerAllHandlers,
  processBulkMessageAsStream,
  getBulkMessage
}
