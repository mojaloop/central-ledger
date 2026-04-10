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
 --------------
 ******/
'use strict'

// TODO Ref

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
const transferSettlementService = require('../../domain/transferSettlement')
const Utility = require('@mojaloop/central-services-shared').Util
const Db = require('../../lib/db')
const LOG_LOCATION = { module: 'grossSettlementHandler', method: '', path: '' } // var object used as pointer
const CONSUMER_COMMIT = true
const FROM_SWITCH = true

const RETRY_OPTIONS = {
  retries: Config.WINDOW_AGGREGATION_RETRY_COUNT,
  minTimeout: Config.WINDOW_AGGREGATION_RETRY_INTERVAL,
  maxTimeout: Config.WINDOW_AGGREGATION_RETRY_INTERVAL
}

async function processTransferSettlement (error, messages) {
  if (error) {
    logger.error(error)
    throw ErrorHandler.Factory.reformatFSPIOPError(error)
  }
  logger.info(Utility.breadcrumb(LOG_LOCATION, messages))
  const message = Array.isArray(messages) ? messages[0] : messages
  const contextFromMessage = EventSdk.Tracer.extractContextFromMessage(message.value)
  const span = EventSdk.Tracer.createChildSpanFromContext('cs_process_transfer_settlement_window', contextFromMessage)

  try {
    logger.info(Utility.breadcrumb(LOG_LOCATION, { method: 'processTransferSettlement' }))
    const payload = message.value.content.payload
    const uriParams = message.value.content.uriParams
    const headers = message.value.content.headers
    const spanTags = Utility.EventFramework.getSpanTags(
      Enum.Events.Event.Type.GROSS_SETTLEMENT,
      Enum.Events.Event.Action.PROCESSING,
      (payload && payload.settlementWindowId) || (uriParams && uriParams.id),
      headers[Enum.Http.Headers.FSPIOP.SOURCE],
      headers[Enum.Http.Headers.FSPIOP.DESTINATION]
    )
    span.setTags(spanTags)
    await span.audit(message, EventSdk.AuditEventAction.start)

    const kafkaTopic = message.topic
    const params = { message, kafkaTopic, span, decodedPayload: payload, consumer: Consumer, producer: Producer }

    const transferEventId = message.value.id
    const transferEventAction = message.value.metadata.event.action
    const transferEventStateStatus = message.value.metadata.event.state.status
    const actionLetter = transferEventAction === Enum.Events.Event.Action.COMMIT
      ? Enum.Events.ActionLetter.commit
      : Enum.Events.ActionLetter.unknown

    if (!payload) {
      logger.info(Utility.breadcrumb(LOG_LOCATION, `missingPayload--${actionLetter}1`))
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError('TransferSettlement handler missing payload')
      const eventDetail = { functionality: Enum.Events.Event.Type.NOTIFICATION, action: Enum.Events.Event.Action.SETTLEMENT_WINDOW }
      await Kafka.proceed(Config.KAFKA_CONFIG, params, { CONSUMER_COMMIT, fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING), eventDetail, FROM_SWITCH })
      throw fspiopError
    }
    logger.info(Utility.breadcrumb(LOG_LOCATION, 'validationPassed'))

    if (transferEventAction === Enum.Events.Event.Action.COMMIT) {
      await retry(async () => { // use bail(new Error('to break before max retries'))
        const knex = Db.getKnex()
        await knex.transaction(async trx => {
          try {
            await transferSettlementService.processMsgFulfil(transferEventId, transferEventStateStatus, trx)
          } catch (err) {
            throw ErrorHandler.Factory.reformatFSPIOPError(err)
          }
        })
        logger.info(Utility.breadcrumb(LOG_LOCATION, `done--${actionLetter}2`))
        return true
      }, RETRY_OPTIONS)
      return true
    }
  } catch (err) {
    logger.error(`${Utility.breadcrumb(LOG_LOCATION)}::${err.message}--0`, err)
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
 * @function registerTransferFulfillHandler
 *
 * @async
 * @description Registers TransferFulfillHandler for processing fulfilled transfers. Gets Kafka config from default.json
 * Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
async function registerTransferSettlement () {
  try {
    const transferFulfillHandler = {
      command: processTransferSettlement,
      topicName: Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, Enum.Events.Event.Type.NOTIFICATION, Enum.Events.Event.Action.EVENT),
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, Enum.Events.Event.Type.NOTIFICATION.toUpperCase(), Enum.Events.Event.Action.EVENT.toUpperCase())
    }
    await Consumer.createHandler(transferFulfillHandler.topicName, transferFulfillHandler.config, transferFulfillHandler.command)
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
async function registerAllHandlers () {
  try {
    await registerTransferSettlement()
    return true
  } catch (err) {
    logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  processTransferSettlement,
  registerAllHandlers,
  registerTransferSettlement
}
