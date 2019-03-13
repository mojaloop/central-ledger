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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>

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
const Kafka = require('../lib/kafka')
const Enum = require('../../lib/enum')
const TransferState = Enum.TransferState
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../lib/config')
const Uuid = require('uuid4')

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
    ['success', 'fspId']
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
    let consumer = {}
    let kafkaTopic
    let transferId = message.value.id
    if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.PREPARE) {
      Logger.info('PositionHandler::positions::prepare')
      kafkaTopic = message.topic
      try {
        consumer = Kafka.Consumer.getConsumer(kafkaTopic)
      } catch (e) {
        Logger.info(`No consumer found for topic ${kafkaTopic}`)
        Logger.error(e)
        histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
      const { preparedMessagesList, limitAlarms } = await PositionService.calculatePreparePositionsBatch(prepareBatch)
      for (let prepareMessage of preparedMessagesList) {
        const { transferState, rawMessage } = prepareMessage
        if (transferState.transferStateId === Enum.TransferState.RESERVED) {
          await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE, rawMessage.value, Utility.ENUMS.STATE.SUCCESS, transferId)
        } else {
          await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.PREPARE, rawMessage.value, Utility.createState(Utility.ENUMS.STATE.FAILURE.status, 4001, transferState.reason), transferId)
        }
        if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
          await consumer.commitMessageSync(message)
        }
      }
      for (let limit of limitAlarms) {
        Logger.info(`Limit alarm should be sent with ${limit}`)
        // Publish alarm message to KafkaTopic for the Hub to consume.The Hub rather than the switch will manage this (the topic is an participantEndpoint)
      }
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.COMMIT) {
      Logger.info('PositionHandler::positions::commit')
      kafkaTopic = message.topic
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
      if (!consumer) {
        Logger.info(`No consumer found for topic ${kafkaTopic}`)
        histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
      // Check current transfer state
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.TransferParticipantRoleType.PAYEE_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
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
      if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
        await consumer.commitMessageSync(message)
      }
      // Will follow framework flow in future
      await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.COMMIT, message.value, Utility.ENUMS.STATE.SUCCESS, transferId)
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.REJECT) {
      Logger.info('PositionHandler::positions::reject')
      kafkaTopic = message.topic
      try {
        consumer = Kafka.Consumer.getConsumer(kafkaTopic)
      } catch (e) {
        Logger.info(`No consumer found for topic ${kafkaTopic}`)
        Logger.error(e)
        histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.TransferParticipantRoleType.PAYER_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
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
      if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
        await consumer.commitMessageSync(message)
      }
      // Will follow framework flow in future
      await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.REJECT, message.value, Utility.ENUMS.STATE.SUCCESS, transferId)
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.TIMEOUT_RESERVED) {
      Logger.info('PositionHandler::positions::timeout')
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.TransferParticipantRoleType.PAYER_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
      if (transferInfo.transferStateId !== TransferState.RESERVED_TIMEOUT) {
        Logger.info('PositionHandler::positions::commit::validationFailed::notReceivedFulfilState')
        // throw Error 2001
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
        kafkaTopic = message.topic
        try {
          consumer = Kafka.Consumer.getConsumer(kafkaTopic)
        } catch (e) {
          Logger.info(`No consumer found for topic ${kafkaTopic}`)
          Logger.error(e)
          histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          return true
        }
        if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
          await consumer.commitMessageSync(message)
        }
        await Utility.produceGeneralMessage(TransferEventType.NOTIFICATION, TransferEventAction.ABORT, newMessage.value, Utility.createState(Utility.ENUMS.STATE.FAILURE.status, 4001, transferStateChange.reason), transferId)
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
      // TODO: Need to understand the purpose of this branch.
      // } else if (message.value.metadata.event.type === TransferEventType.POSITION && message.value.metadata.event.action === TransferEventAction.FAIL) {
      //   Logger.info('PositionHandler::positions::fail')
      //   kafkaTopic = Utility.transformAccountToTopicName(message.value.from, TransferEventType.POSITION, TransferEventAction.ABORT)
      //   consumer = Kafka.Consumer.getConsumer(kafkaTopic)
      //   if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
      //     await consumer.commitMessageSync(message)
      //   }
      //   throw new Error('Position Fail messaged received - What do we do here??')
    } else {
      Logger.info('PositionHandler::positions::invalidEventTypeOrAction')
      kafkaTopic = message.topic
      try {
        consumer = Kafka.Consumer.getConsumer(kafkaTopic)
      } catch (e) {
        Logger.info(`No consumer found for topic ${kafkaTopic}`)
        Logger.error(e)
        histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
      if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
        await consumer.commitMessageSync(message)
      }
      throw new Error('Event type or action is invalid')
    }
  } catch (error) {
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    Logger.error(error)
    throw error
  }
}

/**
 * @function registerPositionHandler
 *
 * @async
 * @description Registers the handler for position topic. Gets Kafka config from default.json
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerPositionHandler = async () => {
  try {
    const positionHandler = {
      command: positions,
      topicName: Utility.transformGeneralTopicName(TransferEventType.POSITION, TransferEventAction.PREPARE),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventAction.POSITION.toUpperCase())
    }
    positionHandler.config.rdkafkaConf['client.id'] = `${positionHandler.config.rdkafkaConf['client.id']}-${Uuid()}`
    await Kafka.Consumer.createHandler(positionHandler.topicName, positionHandler.config, positionHandler.command)
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
 * @description Registers all handlers in positions
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    return await registerPositionHandler()
  } catch (error) {
    throw error
  }
}

module.exports = {
  registerPositionHandler,
  registerAllHandlers,
  positions
}
