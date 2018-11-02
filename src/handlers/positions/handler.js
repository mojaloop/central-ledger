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
 * Valentin Genev <valentin.genev@modusbox.com>

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
const Metrics = require('../../lib/metrics')

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
  const histTimerEnd = Metrics.getHistogram(
    'transfer_position',
    'Consume a prepare transfer message from the kafka topic and process it accordingly',
    ['success']
  ).startTimer()
  if (error) {
    Logger.error(error)
    throw error
  }
  let message = {}
  let prepareBatch = []
  try {
    if (Array.isArray(messages)) {
      prepareBatch = Array.from(messages)
      message = Object.assign(message, JSON.parse(JSON.stringify(prepareBatch[0])))
    } else {
      prepareBatch = [Object.assign({}, JSON.parse(JSON.stringify(messages)))]
      message = Object.assign({}, messages)
    }
    Logger.info('PositionHandler::positions')
    let consumer
    let kafkaTopic
    const payload = message.value.content && message.value.content.payload || {}
    payload.transferId = message.value.id
    kafkaTopic = message.topic
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (e) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(e)
      return true
    }
    if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.PREPARE) {
      Logger.info('PositionHandler::positions::prepare')
      const {preparedMessagesList, limitAlarms} = await PositionService.calculatePreparePositionsBatch(prepareBatch)
      for (let prepareMessage of preparedMessagesList) {
        const {transferState, rawMessage} = prepareMessage
        if (transferState.transferStateId === Enum.TransferState.RESERVED) {
          await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE, rawMessage.value, Utility.ENUMS.STATE.SUCCESS)
        } else {
          await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE, rawMessage.value, Utility.createState(Utility.ENUMS.STATE.FAILURE.status, 4001, transferState.reason))
        }
        if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
          await consumer.commitMessageSync(message)
        }
      }
      for (let limit of limitAlarms) {
        Logger.info(`Limit alarm should be sent with ${limit}`)
        // Publish alarm message to KafkaTopic for the Hub to consume.The Hub rather than the switch will manage this (the topic is an participantEndpoint)
      }
      // setTimeout(()=>{
      histTimerEnd({success: true})
      // }, 150)
      return true
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.COMMIT) {
      Logger.info('PositionHandler::positions::commit')
      // Check current transfer state
      const transferInfo = await TransferService.getTransferInfoToChangePosition(payload.transferId, Enum.TransferParticipantRoleType.PAYEE_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
      if (transferInfo.transferStateId !== TransferState.RECEIVED_FULFIL) {
        Logger.info('PositionHandler::positions::commit::validationFailed::notReceivedFulfilState')
        // TODO: throw Error 2001
      } else { // transfer state check success
        Logger.info('PositionHandler::positions::commit::validationPassed')
        const isReversal = false
        const transferStateChange = {
          transferId: transferInfo.transferId,
          transferStateId: TransferState.COMMITTED
        }
        await PositionService.changeParticipantPosition(transferInfo.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
      }
      // Will follow framework flow in future
      await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, Utility.ENUMS.STATE.SUCCESS)
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.REJECT) {
      Logger.info('PositionHandler::positions::reject')
      const transferInfo = await TransferService.getTransferInfoToChangePosition(payload.transferId, Enum.TransferParticipantRoleType.PAYER_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
      if (transferInfo.transferStateId !== TransferState.REJECTED) {
        Logger.info('PositionHandler::positions::reject::validationFailed::notRejectedState')
        // TODO: throw Error 2001
      } else { // transfer state check success
        Logger.info('PositionHandler::positions::reject::validationPassed')
        const isReversal = true
        const transferStateChange = {
          transferId: transferInfo.transferId,
          transferStateId: TransferState.ABORTED,
          reason: transferInfo.reason
        }
        await PositionService.changeParticipantPosition(transferInfo.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
      }
      // Will follow framework flow in future
      await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.REJECT, message.value, Utility.ENUMS.STATE.SUCCESS)
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.TIMEOUT_RESERVED) {
      Logger.info('PositionHandler::positions::timeout')
      const transferInfo = await TransferService.getTransferInfoToChangePosition(payload.transferId, Enum.TransferParticipantRoleType.PAYER_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
      if (transferInfo.transferStateId !== TransferState.RESERVED_TIMEOUT) {
        Logger.info('PositionHandler::positions::commit::validationFailed::notReceivedFulfilState')
        throw new Error('Internal server error')
      } else { // transfer state check success
        const isReversal = true
        const reason = 'Transfer aborted due to expiration'
        const transferStateChange = {
          transferId: transferInfo.transferId,
          transferStateId: TransferState.EXPIRED_RESERVED,
          reason
        }
        await PositionService.changeParticipantPosition(transferInfo.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
        let newMessage = Object.assign({}, message)
        newMessage.value.content.payload = Utility.createPrepareErrorStatus(3303, reason, newMessage.value.content.payload.extensionList)
        await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.ABORT, newMessage.value, Utility.createState(Utility.ENUMS.STATE.FAILURE.status, 4001, transferStateChange.reason))
      }
    } else {
      Logger.info('PositionHandler::positions::invalidEventTypeOrAction')
    }
    if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
      await consumer.commitMessageSync(message)
    }
    // setTimeout(()=>{
    histTimerEnd({success: true})
    // }, 150)
    return true
  } catch (error) {
    histTimerEnd({success: false})
    Logger.error(error)
    throw error
  }
}

const createPositionHandlers = async (participantName) => {
  try {
    const positionHandler = {
      command: positions,
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
