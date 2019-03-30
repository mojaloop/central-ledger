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
const MainUtil = require('../../lib/util')
const Util = require('../lib/utility')
const Kafka = require('../lib/kafka')
const Enum = require('../../lib/enum')
const TransferState = Enum.TransferState
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../lib/config')
const Uuid = require('uuid4')
const Errors = require('../../lib/errors')

const errorTransferExpCode = 3300
const errorTransferExpDescription = Errors.getErrorDescription(errorTransferExpCode)

const errorType = Errors.errorType
const location = { module: 'PositionHandler', method: '', path: '' } // var object used as pointer
const consumerCommit = true
const fromSwitch = true
// const toDestination = true

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
    // Logger.error(error)
    throw error
  }
  let message = {}
  let prepareBatch = []
  try {
    if (Array.isArray(messages)) {
      prepareBatch = Array.from(messages)
      message = Object.assign(message, MainUtil.clone(prepareBatch[0]))
    } else {
      prepareBatch = [Object.assign({}, MainUtil.clone(messages))]
      message = Object.assign({}, messages)
    }
    const eventType = message.value.metadata.event.type
    const payload = message.value.content.payload
    const action = message.value.metadata.event.action
    const transferId = message.value.id
    const kafkaTopic = message.topic
    let consumer
    Logger.info(Util.breadcrumb(location, { method: 'positions' }))
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (e) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(e)
      histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    const actionLetter = action === TransferEventAction.PREPARE ? Enum.actionLetter.prepare
      : (action === TransferEventAction.COMMIT ? Enum.actionLetter.commit
        : (action === TransferEventAction.REJECT ? Enum.actionLetter.reject
          : (action === TransferEventAction.ABORT ? Enum.actionLetter.abort
            : (action === TransferEventAction.TIMEOUT_RESERVED ? Enum.actionLetter.timeout
              : Enum.actionLetter.unknown))))
    let params = { message, transferId, kafkaTopic, consumer }
    let producer = { functionality: TransferEventType.NOTIFICATION, action }

    if (eventType === TransferEventType.POSITION && action === TransferEventAction.PREPARE) {
      Logger.info(Util.breadcrumb(location, { path: 'prepare' }))
      const { preparedMessagesList, limitAlarms } = await PositionService.calculatePreparePositionsBatch(prepareBatch)
      for (let limit of limitAlarms) {
        // Publish alarm message to KafkaTopic for the Hub to consume as it is the Hub
        // rather than the switch to manage this (the topic is an participantEndpoint)
        Logger.info(`Limit alarm should be sent with ${limit}`)
      }
      for (let prepareMessage of preparedMessagesList) {
        const { transferState, rawMessage } = prepareMessage
        message.value = rawMessage.value
        if (transferState.transferStateId === Enum.TransferState.RESERVED) {
          Logger.info(Util.breadcrumb(location, `payer--${actionLetter}1`))
          return await Util.proceed(params, { consumerCommit, histTimerEnd, producer })
        } else {
          Logger.info(Util.breadcrumb(location, `resetPayer--${actionLetter}2`))
          const errorInformation = Errors.getErrorInformation(errorType.payerFspInsufficientLiquidity)
          return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
        }
      }
    } else if (eventType === TransferEventType.POSITION && action === TransferEventAction.COMMIT) {
      Logger.info(Util.breadcrumb(location, { path: 'commit' }))
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.TransferParticipantRoleType.PAYEE_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
      if (transferInfo.transferStateId !== TransferState.RECEIVED_FULFIL) {
        Logger.info(Util.breadcrumb(location, `validationFailed::notReceivedFulfilState1--${actionLetter}3`))
        const errorInformation = Errors.getErrorInformation(errorType.internal)
        return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer, fromSwitch })
      } else {
        Logger.info(Util.breadcrumb(location, `payee--${actionLetter}4`))
        const isReversal = false
        const transferStateChange = {
          transferId: transferInfo.transferId,
          transferStateId: TransferState.COMMITTED
        }
        await PositionService.changeParticipantPosition(transferInfo.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
        return await Util.proceed(params, { consumerCommit, histTimerEnd, producer })
      }
    } else if (eventType === TransferEventType.POSITION && [TransferEventAction.REJECT, TransferEventAction.ABORT].includes(action)) {
      Logger.info(Util.breadcrumb(location, { path: action }))
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.TransferParticipantRoleType.PAYER_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
      let transferStateId

      if (transferInfo.transferStateId === TransferState.RECEIVED_REJECT) {
        Logger.info(Util.breadcrumb(location, `receivedReject--${actionLetter}5`))
        transferStateId = TransferState.ABORTED_REJECTED
      } else if (transferInfo.transferStateId === TransferState.RECEIVED_ERROR) {
        Logger.info(Util.breadcrumb(location, `receivedError--${actionLetter}5`))
        transferStateId = TransferState.ABORTED_ERROR
      }
      const isReversal = true
      const transferStateChange = {
        transferId: transferInfo.transferId,
        transferStateId,
        reason: transferInfo.reason
      }
      await PositionService.changeParticipantPosition(transferInfo.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
      return await Util.proceed(params, { consumerCommit, histTimerEnd, producer })
    } else if (eventType === TransferEventType.POSITION && action === TransferEventAction.TIMEOUT_RESERVED) {
      Logger.info(Util.breadcrumb(location, { path: 'timeout' }))
      producer.action = TransferEventAction.ABORT
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.TransferParticipantRoleType.PAYER_DFSP, Enum.LedgerEntryType.PRINCIPLE_VALUE)
      if (transferInfo.transferStateId !== TransferState.RESERVED_TIMEOUT) {
        Logger.info(Util.breadcrumb(location, `validationFailed::notReceivedFulfilState2--${actionLetter}6`))
        const errorInformation = Errors.getErrorInformation(errorType.internal)
        throw new Error(errorInformation.errorDescription)
      } else {
        Logger.info(Util.breadcrumb(location, `validationPassed2--${actionLetter}7`))
        const isReversal = true
        const transferStateChange = {
          transferId: transferInfo.transferId,
          transferStateId: TransferState.EXPIRED_RESERVED,
          reason: errorTransferExpDescription
        }
        await PositionService.changeParticipantPosition(transferInfo.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
        let errorInformation = Errors.getErrorInformation(errorType.transferExpired)
        errorInformation.extensionList = payload.extensionList
        return await Util.proceed(params, { consumerCommit, histTimerEnd, errorInformation, producer })
      }
    } else {
      Logger.error(Util.breadcrumb(location, { path: `invalidEventTypeOrAction--${action}8` }))
      await Util.commitMessageSync(kafkaTopic, consumer, message)
      throw new Error(Util.breadcrumb(location))
    }
  } catch (err) {
    Logger.error(`${Util.breadcrumb(location)}::${err.message}--0`)
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    throw err
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
      topicName: Util.transformGeneralTopicName(TransferEventType.POSITION, TransferEventAction.PREPARE),
      config: Util.getKafkaConfig(Util.ENUMS.CONSUMER, TransferEventType.TRANSFER.toUpperCase(), TransferEventAction.POSITION.toUpperCase())
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
