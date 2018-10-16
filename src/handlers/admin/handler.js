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

/**
 * @module src/handlers/transfers
 */

const Logger = require('@mojaloop/central-services-shared').Logger
// const TransferService = require('../../domain/transfer')
const Utility = require('../lib/utility')
const Kafka = require('../lib/kafka')
// const Validator = require('./validator')
// const TransferState = require('../../lib/enum').TransferState
const Enum = require('../../lib/enum')
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction
// const Errors = require('../../lib/errors')

// TODO: This errorCode and errorDescription are dummy values until a rules engine is established
// const errorInternalCode = 2001
// const errorInternalDescription = Errors.getErrorDescription(errorInternalCode)

const transfer = async (error, messages) => {
  if (error) {
    Logger.error(error)
    throw new Error()
  }
  let message = {}
  try {
    if (Array.isArray(messages)) {
      message = messages[0]
    } else {
      message = messages
    }
    Logger.info(`AdminTransferHandler::${message.value.metadata.event.action}`)
    const kafkaTopic = message.topic
    let consumer
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (e) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(e)
      return true
    }
    const metadata = message.value.metadata
    // const transferId = message.value.id
    // const payload = message.value.content.payload
    if (metadata.event.type === TransferEventType.FULFIL && metadata.event.action === TransferEventAction.COMMIT) {
      // const existingTransfer = await TransferService.getById(transferId)
      Logger.info(`AdminTransferHandler::${metadata.event.action}::invalidEventAction`)
      if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
        await consumer.commitMessageSync(message)
      }
      // message.value.content.payload = Utility.createPrepareErrorStatus(errorInternalCode, errorInternalDescription, message.value.content.payload.extensionList)
      // await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, Utility.ENUMS.STATE.FAILURE)
      return true
    }
  } catch (error) {
    Logger.error(error)
    throw error
  }
}

/**
 * @function registerTransferHandler
 *
 * @async
 * @description Registers the one handler for admin transfer (settlement, reconciliation). Gets Kafka config from default.json
 * Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerTransferHandler = async () => {
  try {
    const transferHandler = {
      command: transfer,
      topicName: Utility.transformGeneralTopicName(TransferEventType.ADMIN, TransferEventType.TRANSFER),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TransferEventType.ADMIN.toUpperCase(), TransferEventType.TRANSFER.toUpperCase())
    }
    transferHandler.config.rdkafkaConf['client.id'] = transferHandler.topicName
    await Kafka.Consumer.createHandler(transferHandler.topicName, transferHandler.config, transferHandler.command)
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
 * @description Registers all handlers in transfers
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    await registerTransferHandler()
    return true
  } catch (e) {
    throw e
  }
}

module.exports = {
  registerTransferHandler,
  registerAllHandlers,
  transfer
}
