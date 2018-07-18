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

 * Lazola Lucas <lazola.lucas@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @module src/handlers/positions
 */

const Logger = require('@mojaloop/central-services-shared').Logger
const Projection = require('../../domain/transfer/projection')
const Utility = require('../lib/utility')
const DAO = require('../lib/dao')
const Kafka = require('../lib/kafka')
const Enum = require('../../lib/enum')
const TransferState = Enum.TransferState
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction

/**
 * @function positions
 *
 * @async
 * @description This is the consumer callback function that gets registered to a topic. This then gets a list of messages,
 * we will only ever use the first message in non batch processing. We then break down the message into its payload and
 * begin validating the payload. Once the payload is validated successfully it will be written to the database to
 * the relevant tables. If the validation fails it is still written to the database for auditing purposes but with an
 * ABORT status
 *
 * Projection.updateTransferState called and updates transfer state
 *
 * @param {error} error - error thrown if something fails within Kafka
 * @param {array} messages - a list of messages to consume for the relevant topic
 *
 * @returns {object} - Returns a boolean: true if successful, or throws and error if failed
 */
const positions = async (error, messages) => {
  if (error) {
    Logger.error(error)
    throw error
  }
  let message = {}
  try {
    if (Array.isArray(messages)) {
      message = messages[0]
    } else {
      message = messages
    }
    Logger.info('TransferHandler::position')
    let consumer = {}
    const payload = message.value.content.payload
    if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.PREPARE) {
      // Consumed Prepare message for Payer
      consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TransferEventType.POSITION, TransferEventAction.PREPARE))
      await Projection.updateTransferState(payload, TransferState.RESERVED)
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.COMMIT) {
      // Consumed Commit message for Payee
      consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TransferEventType.POSITION, TransferEventType.FULFIL))
      payload.transferId = message.value.id
      // TODO: Check RECEIVED_FULFIL state
      await Projection.updateTransferState(payload, TransferState.COMMITTED)
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.REJECT) {
      // Consumed Reject message for Payee
      consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TransferEventType.POSITION, TransferEventAction.ABORT))
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.TIMEOUT_RECEIVED) {
      // Consumed timeout for transfer in RECEIVED_PREPARE transferState
      // TODO: Remove from PositionHandler after mojaloop/docs/CentralServices/arch_diagrams/Arch-Flows.svg is updated to queue directly to NotificationHandler
      consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TransferEventType.POSITION, TransferEventAction.ABORT))
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.TIMEOUT_RESERVED) {
      // Consumed timeout for transfer in RESERVED transferState
      consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TransferEventType.POSITION, TransferEventAction.ABORT))
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.FAIL) {
      // Consumed Fail action
      consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TransferEventType.POSITION, TransferEventAction.ABORT))
    } else {
      consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, message.value.metadata.event.type, message.value.metadata.event.action))
      await consumer.commitMessageSync(message)
      throw new Error('Event type or action is invalid')
    }
    await consumer.commitMessageSync(message)
    // Will follow framework flow in future
    await Utility.produceGeneralMessage(TransferEventType.TRANSFER, TransferEventAction.TRANSFER, message.value, Utility.ENUMS.STATE.SUCCESS)

    return true
  } catch (error) {
    Logger.error(error)
    throw error
  }
}

const createPositionHandlers = async (participantName) => {
  try {
    const positionHandler = {
      command: positions,
      // auto.offset.reset: beginning
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TransferEventType.POSITION.toUpperCase(), TransferEventAction.PREPARE.toUpperCase())
    }
    const topicNameList = [
      Utility.transformAccountToTopicName(participantName, TransferEventType.POSITION, TransferEventAction.ABORT),
      Utility.transformAccountToTopicName(participantName, TransferEventType.POSITION, TransferEventType.FULFIL),
      Utility.transformAccountToTopicName(participantName, TransferEventType.POSITION, TransferEventAction.PREPARE)
    ]
    await Kafka.Consumer.createHandler(topicNameList, positionHandler.config, positionHandler.command)
  } catch (error) {
    Logger.error(error)
    throw error
  }
}

/**
 * @function RegisterPositionsHandlers
 *
 * @async
 * @description Registers the position handlers for all participants. Retrieves the list of all participants from the database and loops through each
 * createPositionHandler called to create the handler for each participant
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerPositionHandlers = async () => {
  try {
    const participantList = await DAO.retrieveAllParticipants()
    if (participantList.length !== 0) {
      for (let name of participantList) {
        await createPositionHandlers(name)
      }
      return true
    } else {
      Logger.info('No participants for position handler creation')
      return false
    }
  } catch (error) {
    Logger.error(error)
    throw error
  }
}

/**
 * @function RegisterAllHandlers
 *
 * @async
 * @description Registers all handlers in positions
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    return await registerPositionHandlers()
  } catch (error) {
    throw error
  }
}

module.exports = {
  registerPositionHandlers,
  registerAllHandlers,
  positions
}
