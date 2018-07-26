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
const TransferService = require('../../domain/transfer')
const PositionService = require('../../domain/position')
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
    Logger.info('PositionHandler::positions')
    let consumer = {}
    const payload = message.value.content.payload
    payload.transferId = message.value.id
    if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.PREPARE) {
      Logger.info('PositionHandler::positions::prepare')
      consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TransferEventType.POSITION, TransferEventAction.PREPARE))
      await TransferService.saveTransferStateChange({transferId: payload.transferId, transferStateId: TransferState.RESERVED})
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.COMMIT) {
      Logger.info('PositionHandler::positions::commit')
      consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TransferEventType.POSITION, TransferEventType.FULFIL))
      // Check current transfer state
      const transferInfo = await TransferService.getTransferInfoToChangePosition(payload.transferId, Enum.TransferParticipantRoleType.PAYEE_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
      if (transferInfo.transferStateId !== TransferState.RECEIVED_FULFIL) {
        Logger.info('PositionHandler::positions::commit::validationFailed::notReceivedFulfilState')
        // TODO: throw Error 2001
      } else { // transfer state check success
        Logger.info('PositionHandler::positions::commit::validationPassed')
        const isIncrease = false
        const transferStateChange = {
          transferId: transferInfo.transferId,
          transferStateId: TransferState.COMMITTED
        }
        await PositionService.changeParticipantPosition(transferInfo.participantCurrencyId, isIncrease, transferInfo.amount, transferStateChange)
      }
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.REJECT) {
      Logger.info('PositionHandler::positions::reject')
      consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TransferEventType.POSITION, TransferEventAction.ABORT))
      const transferInfo = await TransferService.getTransferInfoToChangePosition(payload.transferId, Enum.TransferParticipantRoleType.PAYER_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
      if (transferInfo.transferStateId !== TransferState.REJECTED) {
        Logger.info('PositionHandler::positions::reject::validationFailed::notRejectedState')
        // TODO: throw Error 2001
      } else { // transfer state check success
        Logger.info('PositionHandler::positions::reject::validationPassed')
        const isIncrease = false
        const transferStateChange = {
          transferId: transferInfo.transferId,
          transferStateId: TransferState.ABORTED,
          reason: transferInfo.reason
        }
        await PositionService.changeParticipantPosition(transferInfo.participantCurrencyId, isIncrease, transferInfo.amount, transferStateChange)
      }
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.TIMEOUT_RECEIVED) {
      Logger.info('PositionHandler::positions::timeoutPrepared')
      consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TransferEventType.POSITION, TransferEventAction.ABORT))
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.TIMEOUT_RESERVED) {
      Logger.info('PositionHandler::positions::timeout')
      consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TransferEventType.POSITION, TransferEventAction.ABORT))
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.FAIL) {
      Logger.info('PositionHandler::positions::fail')
      consumer = Kafka.Consumer.getConsumer(Utility.transformAccountToTopicName(message.value.from, TransferEventType.POSITION, TransferEventAction.ABORT))
    } else {
      Logger.info('PositionHandler::positions::invalidEventTypeOrAction')
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
 * @param {string[]} participantNames - Array of Participants to register
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerPositionHandlers = async (participantNames = []) => {
  try {
    let participantNamesList
    if (Array.isArray(participantNames) && participantNames.length > 0) {
      participantNamesList = participantNames
    } else {
      participantNamesList = await DAO.retrieveAllParticipants()
    }
    if (participantNamesList.length !== 0) {
      for (let name of participantNamesList) {
        await createPositionHandlers(name)
      }
    } else {
      Logger.info('No participants for position handler creation')
      return false
    }
  } catch (error) {
    Logger.error(error)
    throw error
  }
  return true
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
