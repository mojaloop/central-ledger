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
 * Valentin Genev <valentin.genev@modusbox.com>
 --------------
 ******/
'use strict'

/**
 * @module src/handlers/transfers
 */

const Logger = require('@mojaloop/central-services-shared').Logger
const Utility = require('../lib/utility')
const Kafka = require('../lib/kafka')
const Enum = require('../../lib/enum')
const Time = require('../../lib/time')
const TransferState = Enum.TransferState
const TransferEventType = Enum.transferEventType
const AdminTransferAction = Enum.adminTransferAction
const TransferService = require('../../domain/transfer')
const Db = require('../../db')
const postRelatedActions = [AdminTransferAction.RECORD_FUNDS_IN, AdminTransferAction.RECORD_FUNDS_OUT_PREPARE]
const putRelatedActions = [AdminTransferAction.RECORD_FUNDS_OUT_COMMIT, AdminTransferAction.RECORD_FUNDS_OUT_ABORT]
const allowedActions = [].concat(postRelatedActions).concat(putRelatedActions)

const commitMessageSync = async (kafkaTopic, consumer, message) => {
  if (!Kafka.Consumer.isConsumerAutoCommitEnabled(kafkaTopic)) {
    await consumer.commitMessageSync(message)
  }
  return true
}

const createNewRecordFunds = async (payload, transactionTimestamp, enums) => {
  try {
    Logger.info(`AdminTransferHandler::${payload.action}::validationPassed::newEntry`)
    // Save the valid transfer into the database
    if (payload.action === AdminTransferAction.RECORD_FUNDS_IN) {
      Logger.info(`AdminTransferHandler::${payload.action}::validationPassed::newEntry::RECORD_FUNDS_IN`)

      const knex = Db.getKnex()
      return knex.transaction(async trx => {
        try {
          await TransferService.reconciliationTransferPrepare(payload, transactionTimestamp, enums, trx)
          await TransferService.reconciliationTransferCommit(payload, transactionTimestamp, enums, trx)
          await trx.commit
        } catch (err) {
          await trx.rollback
          throw err
        }
      })
    } else {
      Logger.info(`AdminTransferHandler::${payload.action}::validationPassed::newEntry::RECORD_FUNDS_OUT_PREPARE`)
      await TransferService.reconciliationTransferPrepare(payload, transactionTimestamp, enums)
    }
  } catch (err) {
    Logger.info(`AdminTransferHandler::${payload.action}::validationPassed::duplicate found while inserting into transfer table`)
  }
  return true
}

const changeStatusOfRecordFundsOut = async (payload, transferId, transactionTimestamp, enums) => {
  const existingTransfer = await TransferService.getTransferById(transferId)
  const transferState = await TransferService.getTransferState(transferId)
  if (!existingTransfer) {
    Logger.info(`AdminTransferHandler::${payload.action}::validationFailed::notFound`)
  } else if (transferState.transferStateId !== TransferState.RESERVED) {
    Logger.info(`AdminTransferHandler::${payload.action}::validationFailed::nonReservedState`)
  } else if (new Date(existingTransfer.expirationDate) <= new Date()) {
    Logger.info(`AdminTransferHandler::${payload.action}::validationFailed::transferExpired`)
  } else {
    Logger.info(`AdminTransferHandler::${payload.action}::validationPassed`)
    if (payload.action === AdminTransferAction.RECORD_FUNDS_OUT_COMMIT) {
      Logger.info(`AdminTransferHandler::${payload.action}::validationPassed::RECORD_FUNDS_OUT_COMMIT`)
      await TransferService.reconciliationTransferCommit(payload, transactionTimestamp, enums)
    } else if (payload.action === AdminTransferAction.RECORD_FUNDS_OUT_ABORT) {
      Logger.info(`AdminTransferHandler::${payload.action}::validationPassed::RECORD_FUNDS_OUT_ABORT`)
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
  Logger.info(`AdminTransferHandler::${payload.action}::dupcheck::existsMatching`)
  const currentTransferState = await TransferService.getTransferStateChange(transferId)
  if (!currentTransferState || !currentTransferState.enumeration) {
    Logger.info(`AdminTransferHandler::${payload.action}::dupcheck::existsMatching::transfer state not found`)
  } else {
    const transferStateEnum = currentTransferState.enumeration
    if (transferStateEnum === TransferState.COMMITTED || transferStateEnum === TransferState.ABORTED) {
      Logger.info(`AdminTransferHandler::${payload.action}::dupcheck::existsMatching::request already finalized`)
    } else if (transferStateEnum === TransferState.RECEIVED || transferStateEnum === TransferState.RESERVED) {
      Logger.info(`AdminTransferHandler::${payload.action}::dupcheck::existsMatching::previous request still in progress do nothing`)
    }
  }
  return true
}

const transfer = async (error, messages) => {
  if (error) {
    Logger.error(error)
    throw new Error()
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
      Logger.info(`AdminTransferHandler::validationFailed`)
        // CANNOT BE SAVED BECAUSE NO PAYLOAD IS PROVIDED. What action should be taken?
      return false
    }

    payload.participantCurrencyId = metadata.request.params.id
    const enums = metadata.request.enums
    const transactionTimestamp = Time.getUTCString(new Date())
    Logger.info(`AdminTransferHandler::${metadata.event.action}::${transferId}`)
    const kafkaTopic = message.topic
    let consumer
    try {
      consumer = Kafka.Consumer.getConsumer(kafkaTopic)
    } catch (e) {
      Logger.info(`No consumer found for topic ${kafkaTopic}`)
      Logger.error(e)
      return true
    }
    if (!allowedActions.includes(payload.action)) {
      Logger.info(`AdminTransferHandler::${payload.action}::invalidPayloadAction`)
    }
    if (postRelatedActions.includes(payload.action)) {
      const { existsMatching, existsNotMatching } = await TransferService.validateDuplicateHash(payload)
      if (!existsMatching && !existsNotMatching) {
        Logger.info(`AdminTransferHandler::${payload.action}::transfer does not exist`)
        await createNewRecordFunds(payload, transactionTimestamp, enums)
      } else if (existsMatching) {
        await transferExists(payload, transferId)
      } else {
        Logger.info(`AdminTransferHandler::${payload.action}::dupcheck::existsNotMatching::request exists with different parameters`)
      }
    } else {
      await changeStatusOfRecordFundsOut(payload, transferId, transactionTimestamp, enums)
    }
    return await commitMessageSync(kafkaTopic, consumer, message)
  } catch (error) {
    Logger.error(error)
    throw error
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
      topicName: Utility.transformGeneralTopicName(TransferEventType.ADMIN, TransferEventType.TRANSFER),
      config: Utility.getKafkaConfig(Utility.ENUMS.CONSUMER, TransferEventType.ADMIN.toUpperCase(), TransferEventType.TRANSFER.toUpperCase())
    }
    transferHandler.config.rdkafkaConf['client.id'] = transferHandler.topicName
    await Kafka.Consumer.createHandler(transferHandler.topicName, transferHandler.config, transferHandler.command)
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
 * @description Registers all handlers in transfers
 *
 * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
 */
const registerAllHandlers = async () => {
  try {
    await registerTransferHandler()
    return true
  } catch (e) {
    throw e
  }
}

module.exports = {
  registerTransferHandler,
  registerAllHandlers,
  transfer
}
