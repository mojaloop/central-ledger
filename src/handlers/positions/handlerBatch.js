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

 * INFITX
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>

 --------------
 ******/
'use strict'

/**
 * @module src/handlers/positions
 */

const Logger = require('@mojaloop/central-services-logger')
const EventSdk = require('@mojaloop/event-sdk')
const BinProcessor = require('../../domain/position/binProcessor')
const SettlementModelCached = require('../../models/settlement/settlementModelCached')
const Utility = require('@mojaloop/central-services-shared').Util
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Producer = require('@mojaloop/central-services-stream').Util.Producer
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../lib/config')
const { randomUUID } = require('crypto')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const BatchPositionModel = require('../../models/position/batch')
const decodePayload = require('@mojaloop/central-services-shared').Util.StreamingProtocol.decodePayload

const consumerCommit = true

/**
 * @function positions
 *
 * @async
 * @description This is the consumer callback function that gets registered to a topic. This then gets a list of messages.
 *
 * @param {error} error - error thrown if something fails within Kafka
 * @param {array} messages - a list of messages to consume for the relevant topic
 *
 * @returns {object} - Returns a boolean: true if successful, or throws and error if failed
 */

const positions = async (error, messages) => {
  const histTimerEnd = Metrics.getHistogram(
    'transfer_position_batch',
    'Consume a batch of prepare transfer messages from the kafka topic and process them',
    ['success']
  ).startTimer()

  if (error) {
    histTimerEnd({ success: false })
    throw ErrorHandler.Factory.reformatFSPIOPError(error)
  }
  let consumedMessages = []

  if (Array.isArray(messages)) {
    consumedMessages = Array.from(messages)
  } else {
    consumedMessages = [Object.assign({}, Utility.clone(messages))]
  }

  const firstMessageOffset = consumedMessages[0]?.offset
  const lastMessageOffset = consumedMessages[consumedMessages.length - 1]?.offset
  const binId = `${firstMessageOffset}-${lastMessageOffset}`

  // Iterate through consumedMessages
  const bins = {}
  const lastPerPartition = {}
  for (const message of consumedMessages) {
    const histTimerMsgEnd = Metrics.getHistogram(
      'transfer_position',
      'Process a prepare transfer message',
      ['success', 'action']
    ).startTimer()

    // Create a span for each message
    const contextFromMessage = EventSdk.Tracer.extractContextFromMessage(message.value)
    const span = EventSdk.Tracer.createChildSpanFromContext('cl_transfer_position', contextFromMessage)
    span.setTags({
      processedAsBatch: true,
      binId
    })

    // Assign message to account-bin by accountID and child action-bin by action
    // (References to the messages to be stored in bins, no duplication of messages)
    const accountID = message.key.toString()
    const action = message.value.metadata.event.action
    const accountBin = bins[accountID] || (bins[accountID] = {})
    const actionBin = accountBin[action] || (accountBin[action] = [])

    // Decode the payload and pass it as a separate parameter
    const decodedPayload = decodePayload(message.value.content.payload)
    actionBin.push({
      message,
      decodedPayload,
      span,
      result: {},
      histTimerMsgEnd
    })

    const last = lastPerPartition[message.partition]
    if (!last || message.offset > last.offset) {
      lastPerPartition[message.partition] = message
    }

    await span.audit(message, EventSdk.AuditEventAction.start)
  }

  // Start DB Transaction
  const trx = await BatchPositionModel.startDbTransaction()

  try {
    // Call Bin Processor with the list of account-bins and trx
    const result = await BinProcessor.processBins(bins, trx)

    // If Bin Processor processed bins successfully, commit Kafka offset
    // Commit the offset of last message in the array
    for (const message of Object.values(lastPerPartition)) {
      const params = { message, kafkaTopic: message.topic, consumer: Consumer }
      // We are using Kafka.proceed() to just commit the offset of the last message in the array
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit })
    }

    // Commit DB transaction
    await trx.commit()

    // Loop through results and produce notification messages and audit messages
    for (const item of result.notifyMessages) {
      // Produce notification message and audit message
      const action = item.binItem.message?.value.metadata.event.action
      const eventStatus = item?.message.metadata.event.state.status === Enum.Events.EventStatus.SUCCESS.status ? Enum.Events.EventStatus.SUCCESS : Enum.Events.EventStatus.FAILURE
      await Kafka.produceGeneralMessage(Config.KAFKA_CONFIG, Producer, Enum.Events.Event.Type.NOTIFICATION, action, item.message, eventStatus, null, item.binItem.span)
    }
    histTimerEnd({ success: true })
  } catch (err) {
    // If Bin Processor returns failure
    // -  Rollback DB transaction
    await trx.rollback()

    // - Audit Error for each message
    const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
    const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
    await BinProcessor.iterateThroughBins(bins, async (_accountID, _action, item) => {
      const span = item.span
      await span.error(fspiopError, state)
    })
    histTimerEnd({ success: false })
  } finally {
    // Finish span for each message
    await BinProcessor.iterateThroughBins(bins, async (_accountID, action, item) => {
      item.histTimerMsgEnd({ ...item.result, action })
      const span = item.span
      if (!span.isFinished) {
        await span.finish()
      }
    })
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
    await SettlementModelCached.initialize()
    // If there is no mapping, use default transformGeneralTopicName
    const topicName =
      Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.PREPARE ||
      Kafka.transformGeneralTopicName(
        Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
        Enum.Events.Event.Type.POSITION,
        Enum.Events.Event.Action.PREPARE
      )
    const positionHandler = {
      command: positions,
      topicName,
      // There is no corresponding action for POSITION_BATCH, so using straight value
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, Enum.Events.Event.Type.TRANSFER.toUpperCase(), 'POSITION_BATCH')
    }
    positionHandler.config.rdkafkaConf['client.id'] = `${positionHandler.config.rdkafkaConf['client.id']}-${randomUUID()}`
    await Consumer.createHandler(positionHandler.topicName, positionHandler.config, positionHandler.command)
    return true
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
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
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  registerPositionHandler,
  registerAllHandlers,
  positions
}
