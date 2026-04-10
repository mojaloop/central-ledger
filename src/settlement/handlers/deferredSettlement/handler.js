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
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/
'use strict'

/**
 * @module src/handlers/transfers
 */

const Config = require('../../lib/config')
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const EventSdk = require('@mojaloop/event-sdk')
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const { logger } = require('../../shared/logger')
const Producer = require('@mojaloop/central-services-stream').Util.Producer
const retry = require('async-retry')
const SettlementWindowService = require('../../domain/settlementWindow')
const Utility = require('@mojaloop/central-services-shared').Util

const location = { module: 'deferredSettlementHandler', method: '', path: '' } // var object used as pointer

const consumerCommit = true
const fromSwitch = true

const retryDelay = Config.WINDOW_AGGREGATION_RETRY_INTERVAL
const retryCount = Config.WINDOW_AGGREGATION_RETRY_COUNT
const retryOpts = {
  retries: retryCount,
  minTimeout: retryDelay,
  maxTimeout: retryDelay
}

const closeSettlementWindow = async (error, messages) => {
  if (error) {
    logger.error(error)
    throw ErrorHandler.Factory.reformatFSPIOPError(error)
  }
  const message = Array.isArray(messages) ? messages[0] : messages
  const contextFromMessage = EventSdk.Tracer.extractContextFromMessage(message.value)
  const span = EventSdk.Tracer.createChildSpanFromContext('cs_close_settlement_window', contextFromMessage)

  try {
    logger.info(Utility.breadcrumb(location, { method: 'closeSettlementWindow' }))
    const payload = message.value.content.payload
    const uriParams = message.value.content.uriParams
    const headers = message.value.content.headers
    const spanTags = Utility.EventFramework.getSpanTags(
      Enum.Events.Event.Type.SETTLEMENT_WINDOW,
      Enum.Events.Event.Action.CLOSE,
      (payload && payload.settlementWindowId) || (uriParams && uriParams.id),
      headers[Enum.Http.Headers.FSPIOP.SOURCE],
      headers[Enum.Http.Headers.FSPIOP.DESTINATION]
    )
    span.setTags(spanTags)
    await span.audit(message, EventSdk.AuditEventAction.start)

    const metadata = message.value.metadata
    const action = metadata.event.action

    const kafkaTopic = message.topic
    const params = { message, kafkaTopic, span, decodedPayload: payload, consumer: Consumer, producer: Producer }

    const actionLetter = action === Enum.Events.Event.Action.CLOSE
      ? Enum.Events.ActionLetter.close
      : Enum.Events.ActionLetter.unknown

    if (!payload) {
      logger.info(Utility.breadcrumb(location, `missingPayload--${actionLetter}1`))
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError('Settlement window handler missing payload')
      const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action: Enum.Events.Event.Action.SETTLEMENT_WINDOW }
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, fromSwitch })
      throw fspiopError
    }
    const settlementWindowId = payload.settlementWindowId
    const reason = payload.reason
    logger.info(Utility.breadcrumb(location, 'validationPassed'))
    await Kafka.commitMessageSync(Consumer, kafkaTopic, message)

    await retry(async () => { // use bail(new Error('to break before max retries'))
      const settlementWindow = await SettlementWindowService.close(settlementWindowId, reason)
      if (!settlementWindow || settlementWindow.state !== Enum.Settlements.SettlementWindowState.CLOSED) {
        logger.info(Utility.breadcrumb(location, { path: 'windowCloseRetry' }))
        const errorDescription = `Settlement window close failed after max retry count ${retryCount} has been exhausted in ${retryCount * retryDelay / 1000}s`
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, errorDescription)
      }
      logger.info(Utility.breadcrumb(location, `done--${actionLetter}2`))
      return true
    }, retryOpts)
    return true
  } catch (err) {
    logger.error(`${Utility.breadcrumb(location)}::${err.message}--0`, err)
    const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
    const state = new EventSdk.EventStateMetadata(
      EventSdk.EventStatusType.failed,
      fspiopError.apiErrorCode.code,
      fspiopError.apiErrorCode.message
    )
    await span.error(fspiopError, state)
    await span.finish(fspiopError.message, state)
    return true
  } finally {
    if (!span.isFinished) {
      await span.finish()
    }
  }
}

/**
 * @function registerSettlementWindowHandler
 *
 * @async
 * @description Registers SettlementWindowHandler for processing windows closure. Gets Kafka config from default.json
 * Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerSettlementWindowHandler = async () => {
  try {
    const settlementWindowHandler = {
      command: closeSettlementWindow,
      topicName: Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, Enum.Events.Event.Type.DEFERRED_SETTLEMENT, Enum.Events.Event.Action.CLOSE),
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, Enum.Events.Event.Type.DEFERRED_SETTLEMENT.toUpperCase(), Enum.Events.Event.Action.CLOSE.toUpperCase())
    }
    await Consumer.createHandler(settlementWindowHandler.topicName, settlementWindowHandler.config, settlementWindowHandler.command)
    return true
  } catch (err) {
    logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/**
 * @function RegisterAllHandlers
 *
 * @async
 * @description Registers all handlers
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    await registerSettlementWindowHandler()
    return true
  } catch (err) {
    logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  closeSettlementWindow,
  registerAllHandlers,
  registerSettlementWindowHandler
}
