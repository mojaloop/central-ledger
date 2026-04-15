/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * ModusBox
 - Deon Botha <deon.botha@modusbox.com>
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Miguel de Barros <miguel.debarros@modusbox.com>
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 - Valentin Genev <valentin.genev@modusbox.com>
 - Lazola Lucas <lazola.lucas@modusbox.com>
--------------
 ******/

const Config = require('../../lib/config')
const Enum = require('@mojaloop/central-services-shared').Enum
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const hasFilters = require('./../../utils/truthyProperty')
const Producer = require('@mojaloop/central-services-stream').Util.Producer
const KafkaUtil = require('@mojaloop/central-services-shared').Util.Kafka
const SettlementWindowModel = require('../../models/settlementWindow')
const SettlementWindowContentModel = require('../../models/settlementWindowContent')
const StreamingProtocol = require('@mojaloop/central-services-shared').Util.StreamingProtocol
const { logger } = require('../../shared/logger')
const idGenerator = require('@mojaloop/central-services-shared').Util.id
const generateULID = idGenerator({ type: 'ulid' })

module.exports = {
  getById: async function (params, enums, options) {
    const settlementWindow = await SettlementWindowModel.getById(params)

    if (settlementWindow) {
      const settlementWindowContent = await SettlementWindowContentModel.getBySettlementWindowId(settlementWindow.settlementWindowId)

      if (settlementWindowContent) {
        settlementWindow.content = settlementWindowContent
        return settlementWindow
      } else {
        const error = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `No records for settlementWidowContentId : ${params.settlementWindowId} found`)
        logger.error(error)
        throw error
      }
    } else {
      const error = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `No record for settlementWindowId: ${params.settlementWindowId} found`)
      logger.error(error)
      throw error
    }
  },

  getByParams: async function (params, enums) {
    // 4 filters - at least one should be used
    if (hasFilters(params.query) && Object.keys(params.query).length < 6) {
      const settlementWindows = await SettlementWindowModel.getByParams(params, enums)
      if (settlementWindows && settlementWindows.length > 0) {
        for (const settlementWindow of settlementWindows) {
          const settlementWindowContent = await SettlementWindowContentModel.getBySettlementWindowId(settlementWindow.settlementWindowId)
          if (settlementWindowContent) {
            settlementWindow.content = settlementWindowContent
          } else {
            const error = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `No records for settlementWidowContentId : ${settlementWindow.settlementWindowId} found`)
            logger.error(error)
            throw error
          }
        }
        return settlementWindows
      } else {
        const error = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `settlementWindow by filters: ${JSON.stringify(params.query).replace(/"/g, '')} not found`)
        logger.error(error)
        throw error
      }
    } else {
      const error = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'Use at least one parameter: participantId, state, fromDateTime, toDateTime, currency')
      logger.error(error)
      throw error
    }
  },

  process: async function (params, enums) {
    const settlementWindowId = await SettlementWindowModel.process(params, enums)
    const messageId = generateULID()
    const eventId = generateULID()
    const state = StreamingProtocol.createEventState(Enum.Events.EventStatus.SUCCESS.status, Enum.Events.EventStatus.SUCCESS.code, Enum.Events.EventStatus.SUCCESS.description)
    const event = StreamingProtocol.createEventMetadata(Enum.Events.Event.Type.DEFERRED_SETTLEMENT, Enum.Events.Event.Action.CLOSE, state)
    const metadata = StreamingProtocol.createMetadata(eventId, event)
    const messageProtocol = StreamingProtocol.createMessage(messageId, Config.HUB_NAME, Config.HUB_NAME, metadata, params.headers, params)
    const topicConfig = KafkaUtil.createGeneralTopicConf(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, Enum.Events.Event.Type.DEFERRED_SETTLEMENT, Enum.Events.Event.Action.CLOSE)
    const kafkaConfig = KafkaUtil.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.PRODUCER, Enum.Events.Event.Type.DEFERRED_SETTLEMENT.toUpperCase(), Enum.Events.Event.Action.CLOSE.toUpperCase())
    await Producer.produceMessage(messageProtocol, topicConfig, kafkaConfig)

    return SettlementWindowModel.getById({ settlementWindowId }, enums)
  },

  close: async function (settlementWindowId, reason) {
    await SettlementWindowModel.close(settlementWindowId, reason)
    return SettlementWindowModel.getById({ settlementWindowId })
  }
}
