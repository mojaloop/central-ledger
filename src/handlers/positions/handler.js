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
 - Lazola Lucas <lazola.lucas@modusbox.com>
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 - Miguel de Barros <miguel.debarros@modusbox.com>
 - Valentin Genev <valentin.genev@modusbox.com>
 - Shashikant Hirugade <shashikant.hirugade@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @module src/handlers/positions
 */

const Logger = require('@mojaloop/central-services-shared').Logger
const TransferService = require('../../domain/transfer')
const PositionService = require('../../domain/position')
const Utility = require('@mojaloop/central-services-shared').Util
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Enum = require('@mojaloop/central-services-shared').Enum
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../lib/config')
const Uuid = require('uuid4')
const decodePayload = require('@mojaloop/central-services-stream').Kafka.Protocol.decodePayload
const decodeMessages = require('@mojaloop/central-services-stream').Kafka.Protocol.decodeMessages
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const location = { module: 'PositionHandler', method: '', path: '' } // var object used as pointer

const consumerCommit = true
const fromSwitch = true

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
    throw ErrorHandler.Factory.reformatFSPIOPError(error)
  }
  let message = {}
  let prepareBatch = []
  try {
    if (Array.isArray(messages)) {
      prepareBatch = Array.from(messages)
      message = Object.assign(message, Utility.clone(prepareBatch[0]))
    } else {
      prepareBatch = [Object.assign({}, Utility.clone(messages))]
      message = Object.assign({}, messages)
    }
    const payload = decodePayload(message.value.content.payload)
    const eventType = message.value.metadata.event.type
    const action = message.value.metadata.event.action
    const transferId = payload.transferId || (message.value.content.uriParams && message.value.content.uriParams.id)
    if (!transferId) {
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError('transferId is null or undefined')
      Logger.error(fspiopError)
      throw fspiopError
    }
    const kafkaTopic = message.topic
    let consumer
    Logger.info(Utility.breadcrumb(location, { method: 'positions' }))
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (e) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(e)
      histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
    const actionLetter = action === Enum.Events.Event.Action.PREPARE ? Enum.Events.ActionLetter.prepare
      : (action === Enum.Events.Event.Action.COMMIT ? Enum.Events.ActionLetter.commit
        : (action === Enum.Events.Event.Action.REJECT ? Enum.Events.ActionLetter.reject
          : (action === Enum.Events.Event.Action.ABORT ? Enum.Events.ActionLetter.abort
            : (action === Enum.Events.Event.Action.TIMEOUT_RESERVED ? Enum.Events.ActionLetter.timeout
              : (action === Enum.Events.Event.Action.BULK_PREPARE ? Enum.Events.ActionLetter.bulkPrepare
                : (action === Enum.Events.Event.Action.BULK_COMMIT ? Enum.Events.ActionLetter.bulkCommit
                  : Enum.Events.ActionLetter.unknown))))))
    const params = { message, kafkaTopic, consumer, decodedPayload: payload }
    const producer = { action }
    if (![Enum.Events.Event.Action.BULK_PREPARE, Enum.Events.Event.Action.BULK_COMMIT].includes(action)) {
      producer.functionality = Enum.Events.Event.Type.NOTIFICATION
    } else {
      producer.functionality = Enum.Events.Event.Type.BULK_PROCESSING
    }

    if (eventType === Enum.Events.Event.Type.POSITION && [Enum.Events.Event.Action.PREPARE, Enum.Events.Event.Action.BULK_PREPARE].includes(action)) {
      Logger.info(Utility.breadcrumb(location, { path: 'prepare' }))
      const { preparedMessagesList, limitAlarms } = await PositionService.calculatePreparePositionsBatch(decodeMessages(prepareBatch))
      for (const limit of limitAlarms) {
        // Publish alarm message to KafkaTopic for the Hub to consume as it is the Hub
        // rather than the switch to manage this (the topic is an participantEndpoint)
        Logger.info(`Limit alarm should be sent with ${limit}`)
      }
      for (const prepareMessage of preparedMessagesList) {
        const { transferState } = prepareMessage
        if (transferState.transferStateId === Enum.Transfers.TransferState.RESERVED) {
          Logger.info(Utility.breadcrumb(location, `payer--${actionLetter}1`))
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, producer })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          return true
        } else {
          Logger.info(Utility.breadcrumb(location, `resetPayer--${actionLetter}2`))
          const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_INSUFFICIENT_LIQUIDITY).toApiErrorObject()
          await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError, producer, fromSwitch })
          histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
          return true
        }
      }
    } else if (eventType === Enum.Events.Event.Type.POSITION && [Enum.Events.Event.Action.COMMIT, Enum.Events.Event.Action.BULK_COMMIT].includes(action)) {
      Logger.info(Utility.breadcrumb(location, { path: 'commit' }))
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.Accounts.TransferParticipantRoleType.PAYEE_DFSP, Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
      if (transferInfo.transferStateId !== Enum.Transfers.TransferInternalState.RECEIVED_FULFIL) {
        Logger.info(Utility.breadcrumb(location, `validationFailed::notReceivedFulfilState1--${actionLetter}3`))
        const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError().toApiErrorObject()
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError, producer, fromSwitch })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      } else {
        Logger.info(Utility.breadcrumb(location, `payee--${actionLetter}4`))
        const isReversal = false
        const transferStateChange = {
          transferId: transferInfo.transferId,
          transferStateId: Enum.Transfers.TransferState.COMMITTED
        }
        await PositionService.changeParticipantPosition(transferInfo.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, producer })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
    } else if (eventType === Enum.Events.Event.Type.POSITION && [Enum.Events.Event.Action.REJECT, Enum.Events.Event.Action.ABORT].includes(action)) {
      Logger.info(Utility.breadcrumb(location, { path: action }))
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.Accounts.TransferParticipantRoleType.PAYER_DFSP, Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
      let transferStateId

      if (transferInfo.transferStateId === Enum.Transfers.TransferInternalState.RECEIVED_REJECT) {
        Logger.info(Utility.breadcrumb(location, `receivedReject--${actionLetter}5`))
        transferStateId = Enum.Transfers.TransferInternalState.ABORTED_REJECTED
      } else if (transferInfo.transferStateId === Enum.Transfers.TransferInternalState.RECEIVED_ERROR) {
        Logger.info(Utility.breadcrumb(location, `receivedError--${actionLetter}5`))
        transferStateId = Enum.Transfers.TransferInternalState.ABORTED_ERROR
      }
      const isReversal = true
      const transferStateChange = {
        transferId: transferInfo.transferId,
        transferStateId,
        reason: transferInfo.reason
      }
      await PositionService.changeParticipantPosition(transferInfo.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, producer })
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    } else if (eventType === Enum.Events.Event.Type.POSITION && action === Enum.Events.Event.Action.TIMEOUT_RESERVED) {
      Logger.info(Utility.breadcrumb(location, { path: 'timeout' }))
      producer.action = Enum.Events.Event.Action.ABORT
      const transferInfo = await TransferService.getTransferInfoToChangePosition(transferId, Enum.Accounts.TransferParticipantRoleType.PAYER_DFSP, Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
      if (transferInfo.transferStateId !== Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT) {
        Logger.info(Utility.breadcrumb(location, `validationFailed::notReceivedFulfilState2--${actionLetter}6`))
        throw ErrorHandler.Factory.createInternalServerFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.message)
      } else {
        Logger.info(Utility.breadcrumb(location, `validationPassed2--${actionLetter}7`))
        const isReversal = true
        const transferStateChange = {
          transferId: transferInfo.transferId,
          transferStateId: Enum.Transfers.TransferInternalState.EXPIRED_RESERVED,
          reason: ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.message
        }
        await PositionService.changeParticipantPosition(transferInfo.participantCurrencyId, isReversal, transferInfo.amount, transferStateChange)
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.EXPIRED_ERROR, null, null, null, payload.extensionList).toApiErrorObject()
        await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError, producer })
        histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
        return true
      }
    } else {
      Logger.info(Utility.breadcrumb(location, `invalidEventTypeOrAction--${actionLetter}8`))
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError().toApiErrorObject()
      const producer = { functionality: Enum.Events.Event.Type.NOTIFICATION, action: Enum.Events.Event.Action.POSITION }
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError, producer, fromSwitch })
      histTimerEnd({ success: true, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
      return true
    }
  } catch (err) {
    Logger.error(`${Utility.breadcrumb(location)}::${err.message}--0`)
    histTimerEnd({ success: false, fspId: Config.INSTRUMENTATION_METRICS_LABELS.fspId })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
      topicName: Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, Enum.Events.Event.Type.POSITION, Enum.Events.Event.Action.PREPARE),
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, Enum.Events.Event.Type.TRANSFER.toUpperCase(), Enum.Events.Event.Action.POSITION.toUpperCase())
    }
    positionHandler.config.rdkafkaConf['client.id'] = `${positionHandler.config.rdkafkaConf['client.id']}-${Uuid()}`
    await Kafka.Consumer.createHandler(positionHandler.topicName, positionHandler.config, positionHandler.command)
    return true
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  registerPositionHandler,
  registerAllHandlers,
  positions
}
