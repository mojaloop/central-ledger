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
 - Valentin Genev <valentin.genev@modusbox.com>
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/
'use strict'

/**
 * @module src/handlers/transfers
 */

const Logger = require('@mojaloop/central-services-logger')
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum
const Time = require('@mojaloop/central-services-shared').Util.Time
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators
const Config = require('../../lib/config')
const TransferService = require('../../domain/transfer')
const Db = require('../../lib/db')
const httpPostRelatedActions = [Enum.Events.Event.Action.RECORD_FUNDS_IN, Enum.Events.Event.Action.RECORD_FUNDS_OUT_PREPARE_RESERVE]
const httpPutRelatedActions = [Enum.Events.Event.Action.RECORD_FUNDS_OUT_COMMIT, Enum.Events.Event.Action.RECORD_FUNDS_OUT_ABORT]
const allowedActions = [].concat(httpPostRelatedActions).concat(httpPutRelatedActions)

const createRecordFundsInOut = async (payload, transactionTimestamp, enums) => {
  /** @namespace Db.getKnex **/
  const knex = Db.getKnex()

  Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::validationPassed::newEntry`)
  // Save the valid transfer into the database
  if (payload.action === Enum.Events.Event.Action.RECORD_FUNDS_IN) {
    Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::validationPassed::newEntry::RECORD_FUNDS_IN`)
    return knex.transaction(async trx => {
      try {
        await TransferService.reconciliationTransferPrepare(payload, transactionTimestamp, enums, trx)
        await TransferService.reconciliationTransferReserve(payload, transactionTimestamp, enums, trx)
        await TransferService.reconciliationTransferCommit(payload, transactionTimestamp, enums, trx)
        await trx.commit
      } catch (err) {
        await trx.rollback
        throw ErrorHandler.Factory.reformatFSPIOPError(err)
      }
    })
  } else {
    Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::validationPassed::newEntry::RECORD_FUNDS_OUT_PREPARE_RESERVE`)
    return knex.transaction(async trx => {
      try {
        await TransferService.reconciliationTransferPrepare(payload, transactionTimestamp, enums, trx)
        await TransferService.reconciliationTransferReserve(payload, transactionTimestamp, enums, trx)
        await trx.commit
      } catch (err) {
        await trx.rollback
        throw ErrorHandler.Factory.reformatFSPIOPError(err)
      }
    })
  }
}

const changeStatusOfRecordFundsOut = async (payload, transferId, transactionTimestamp, enums) => {
  const existingTransfer = await TransferService.getTransferById(transferId)
  const transferState = await TransferService.getTransferState(transferId)
  if (!existingTransfer) {
    Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::validationFailed::notFound`)
  } else if (transferState.transferStateId !== Enum.Transfers.TransferState.RESERVED) {
    Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::validationFailed::nonReservedState`)
  } else if (new Date(existingTransfer.expirationDate) <= new Date()) {
    Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::validationFailed::transferExpired`)
  } else {
    Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::validationPassed`)
    if (payload.action === Enum.Events.Event.Action.RECORD_FUNDS_OUT_COMMIT) {
      Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::validationPassed::RECORD_FUNDS_OUT_COMMIT`)
      await TransferService.reconciliationTransferCommit(payload, transactionTimestamp, enums)
    } else if (payload.action === Enum.Events.Event.Action.RECORD_FUNDS_OUT_ABORT) {
      Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::validationPassed::RECORD_FUNDS_OUT_ABORT`)
      payload.amount = {
        amount: existingTransfer.amount,
        currency: existingTransfer.currencyId
      }
      await TransferService.reconciliationTransferAbort(payload, transactionTimestamp, enums)
    }
  }
  return true
}

const transferExists = async (payload, transferId) => {
  Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::dupcheck::existsMatching`)
  const currentTransferState = await TransferService.getTransferStateChange(transferId)
  if (!currentTransferState || !currentTransferState.enumeration) {
    Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::dupcheck::existsMatching::transfer state not found`)
  } else {
    const transferStateEnum = currentTransferState.enumeration
    if (transferStateEnum === Enum.Transfers.TransferState.COMMITTED || transferStateEnum === Enum.Transfers.TransferInternalState.ABORTED_REJECTED) {
      Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::dupcheck::existsMatching::request already finalized`)
    } else if (transferStateEnum === Enum.Transfers.TransferInternalState.RECEIVED_PREPARE || transferStateEnum === Enum.Transfers.TransferState.RESERVED) {
      Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::dupcheck::existsMatching::previous request still in progress do nothing`)
    }
  }
  return true
}

const transfer = async (error, messages) => {
  if (error) {
    Logger.isErrorEnabled && Logger.error(error)
    throw ErrorHandler.Factory.reformatFSPIOPError(error)
  }
  let message = {}
  try {
    if (Array.isArray(messages)) {
      message = messages[0]
    } else {
      message = messages
    }
    const payload = message.value.content.payload
    const metadata = message.value.metadata
    const transferId = message.value.id

    if (!payload) {
      Logger.isInfoEnabled && Logger.info('AdminTransferHandler::validationFailed')
      // TODO: Cannot be saved because no payload has been provided. What action should be taken?
      return false
    }

    payload.participantCurrencyId = metadata.request.params.id
    const enums = metadata.request.enums
    const transactionTimestamp = Time.getUTCString(new Date())
    Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${metadata.event.action}::${transferId}`)
    const kafkaTopic = message.topic

    if (!allowedActions.includes(payload.action)) {
      Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::invalidPayloadAction`)
    }
    if (httpPostRelatedActions.includes(payload.action)) {
      const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(transferId, payload, TransferService.getTransferDuplicateCheck, TransferService.saveTransferDuplicateCheck)
      if (!hasDuplicateId) {
        Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::transfer does not exist`)
        await createRecordFundsInOut(payload, transactionTimestamp, enums)
      } else if (hasDuplicateHash) {
        await transferExists(payload, transferId)
      } else {
        Logger.isInfoEnabled && Logger.info(`AdminTransferHandler::${payload.action}::dupcheck::existsNotMatching::request exists with different parameters`)
      }
    } else {
      await changeStatusOfRecordFundsOut(payload, transferId, transactionTimestamp, enums)
    }
    await Kafka.commitMessageSync(Consumer, kafkaTopic, message)
    return true
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/**
 * @function registerTransferHandler
 *
 * @async
 * @description Registers the one handler for admin transfer (settlement, reconciliation). Gets Kafka config from default.json
 * Calls createHandler to register the handler against the Stream Processing API
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerTransferHandler = async () => {
  try {
    const transferHandler = {
      command: transfer,
      topicName: Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, Enum.Events.Event.Type.ADMIN, Enum.Events.Event.Action.TRANSFER),
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, Enum.Events.Event.Type.ADMIN.toUpperCase(), Enum.Events.Event.Action.TRANSFER.toUpperCase())
    }
    transferHandler.config.rdkafkaConf['client.id'] = transferHandler.topicName
    await Consumer.createHandler(transferHandler.topicName, transferHandler.config, transferHandler.command)
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
 * @description Registers all handlers in transfers
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    await registerTransferHandler()
    return true
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  registerAllHandlers,
  transfer
}
