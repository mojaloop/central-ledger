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
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * @module src/models/position/
 */

const Db = require('../../db')
const Enum = require('../../lib/enum')
const participantFacade = require('../participant/facade')
const Errors = require('../../lib/errors')
const Logger = require('@mojaloop/central-services-shared').Logger
const Time = require('../../lib/time')

const prepareChangeParticipantPositionTransaction = async (transferList) => {
  try {
    const knex = await Db.getKnex()
    const participantName = transferList[0].value.content.payload.payerFsp
    const currencyId = transferList[0].value.content.payload.amount.currency
    const participantCurrency = await participantFacade.getByNameAndCurrency(participantName, currencyId, Enum.LedgerAccountType.POSITION)
    let processedTransfers = {} // The list of processed transfers - so that we can store the additional information around the decision. Most importantly the "running" position
    let reservedTransfers = []
    let abortedTransfers = []
    let initialTransferStateChangePromises = []
    let transferIdList = []
    let limitAlarms = []
    let sumTransfersInBatch = 0
    await knex.transaction(async (trx) => {
      try {
        for (let transfer of transferList) {
          // const initialTransferStateChangeList = await knex('transferStateChange').transacting(trx).whereIn('transferId', transferIdList).forUpdate().orderBy('transferStateChangeId', 'desc')
          // ^^^^^ this is how we want to get this later to reduce the DB queries into one.

          /*
          TODO Possibly the commented block of validations in this comment block will be validated with message validations for each topic
          (are they valid or not LIME messages and are they valid for the given topic)
           ====
           Since iterating over the list of transfers, validate here that each transfer is for the PayerFSP and Currency
           if (participantName !== transfer.value.content.payload.payerFSP)
             {} // log error for particular transfer because it should not be in this topic (and might be injected)
           if (currencyId != transfer.value.content.payload.payerFSP)
             {} // log error for particular transfer because it should not be in this topic (and might be injected)
           ====
           */

          const id = transfer.value.content.payload.transferId
          transferIdList.push(id)
          initialTransferStateChangePromises.push(await knex('transferStateChange').transacting(trx).where('transferId', id).orderBy('transferStateChangeId', 'desc').first())
        }
        let initialTransferStateChangeList = await Promise.all(initialTransferStateChangePromises)
        for (let id in initialTransferStateChangeList) {
          let transferState = initialTransferStateChangeList[id]
          let transfer = transferList[id].value.content.payload
          let rawMessage = transferList[id]
          if (transferState.transferStateId === Enum.TransferState.RECEIVED_PREPARE) {
            transferState.transferStateChangeId = null
            transferState.transferStateId = Enum.TransferState.RESERVED
            let transferAmount = parseFloat(transfer.amount.amount) /* Just do this once,so add to reservedTransfers */
            reservedTransfers[transfer.transferId] = { transferState, transfer, rawMessage, transferAmount }
            sumTransfersInBatch += transferAmount
          } else {
            transferState.transferStateChangeId = null
            transferState.transferStateId = Enum.TransferState.ABORTED
            transferState.reason = 'Transfer in incorrect state'
            abortedTransfers[transfer.transferId] = { transferState, transfer, rawMessage }
          }
        }
        let abortedTransferStateChangeList = Object.keys(abortedTransfers).length && Array.from(transferIdList.map(transferId => abortedTransfers[transferId].transferState))
        Object.keys(abortedTransferStateChangeList).length && await knex.batchInsert('transferStateChange', abortedTransferStateChangeList).transacting(trx)
        // Get the effective position for this participantCurrency at the start of processing the Batch
        // and reserved the total value of the transfers in the batch (sumTransfersInBatch)
        const initialParticipantPosition = await knex('participantPosition').transacting(trx).where({ participantCurrencyId: participantCurrency.participantCurrencyId }).forUpdate().select('*').first()
        let currentPosition = parseFloat(initialParticipantPosition.value)
        let reservedPosition = parseFloat(initialParticipantPosition.reservedValue)
        let effectivePosition = currentPosition + reservedPosition
        initialParticipantPosition.reservedValue += sumTransfersInBatch
        await knex('participantPosition').transacting(trx).where({ participantPositionId: initialParticipantPosition.participantPositionId }).update(initialParticipantPosition)
        // Get the actual position limit and calculate the available position for the transfers to use in this batch
        // Note: see optimisation decision notes to understand the justification for the algorithm
        const participantLimit = await participantFacade.getParticipantLimitByParticipantCurrencyLimit(participantCurrency.participantId, participantCurrency.currencyId, Enum.LedgerAccountType.POSITION, Enum.ParticipantLimitType.NET_DEBIT_CAP)
        let availablePosition = participantLimit.value - effectivePosition
        /* Validate entire batch if availablePosition >= sumTransfersInBatch - the impact is that applying per transfer rules would require to be handled differently
           since further rules are expected we do not do this at this point
           As we enter this next step the order in which the transfer is processed against the Position is critical.
           Both positive and failure cases need to recorded in processing order
           This means that they should not be removed from the list, and the participantPosition
        */
        let sumReserved = 0 // Record the sum of the transfers we allow to progress to RESERVED
        for (let transferId in reservedTransfers) {
          let { transfer, transferState, rawMessage, transferAmount } = reservedTransfers[transferId]
          if (availablePosition >= transferAmount) {
            availablePosition -= transferAmount
            transferState.transferStateId = Enum.TransferState.RESERVED
            sumReserved += transferAmount /* actually used */
          } else {
            transferState.transferStateId = Enum.TransferState.ABORTED
            transferState.reason = Errors.getErrorDescription(4001)
            rawMessage.value.content.payload = {
              errorInformation: Errors.createErrorInformation(4001, rawMessage.value.content.payload.extensionList)
            }
          }
          let runningPosition = currentPosition + sumReserved /* effective position */
          let runningReservedValue = sumTransfersInBatch - sumReserved
          processedTransfers[transferId] = { transferState, transfer, rawMessage, transferAmount, runningPosition, runningReservedValue }
        }
        /*
          Update the participanyPosition with the eventual impact of the Batch
          So the position moves forward by the sum of the transfers actually reserved (sumReserved)
          and the reserved amount is cleared of the we reserved in the first instance (sumTransfersInBatch)
        */
        let processedPositionValue = initialParticipantPosition.value + sumReserved
        await knex('participantPosition').transacting(trx).where({ participantPositionId: initialParticipantPosition.participantPositionId }).update({
          value: processedPositionValue,
          reservedValue: initialParticipantPosition.reservedValue - sumTransfersInBatch
        })
        // TODO this limit needs to be clarified
        if (processedPositionValue > participantLimit.value * participantLimit.thresholdAlarmPercentage) {
          limitAlarms.push(participantLimit)
        }
        /*
          Persist the transferStateChanges and associated participantPositionChange entry to record the running position
          The transferStateChanges need to be persisted first (by INSERTing) to have the PK reference
        */
        await knex('transfer').transacting(trx).forUpdate().whereIn('transferId', transferIdList).select('*')
        let processedTransferStateChangeList = Object.keys(processedTransfers).length && Array.from(transferIdList.map(transferId => processedTransfers[transferId].transferState))
        let processedTransferStateChangeIdList = processedTransferStateChangeList && Object.keys(processedTransferStateChangeList).length && await knex.batchInsert('transferStateChange', processedTransferStateChangeList).transacting(trx)
        let processedTransfersKeysList = Object.keys(processedTransfers)
        let batchParticipantPositionChange = []
        for (let keyIndex in processedTransfersKeysList) {
          let { runningPosition, runningReservedValue } = processedTransfers[processedTransfersKeysList[keyIndex]]
          const participantPositionChange = {
            participantPositionId: initialParticipantPosition.participantPositionId,
            transferStateChangeId: processedTransferStateChangeIdList[keyIndex],
            value: runningPosition,
            // processBatch: <uuid> - a single value uuid for this entire batch to make sure the set of transfers in this batch canbe clearly grouped
            reservedValue: runningReservedValue
          }
          batchParticipantPositionChange.push(participantPositionChange)
        }
        batchParticipantPositionChange.length && await knex.batchInsert('participantPositionChange ', batchParticipantPositionChange).transacting(trx)
        await trx.commit
      } catch (e) {
        Logger.error(e)
        await trx.rollback
        throw e
      }
    })
    let preparedMessagesList = Array.from(transferIdList.map(transferId =>
      transferId in processedTransfers
        ? reservedTransfers[transferId]
        : abortedTransfers[transferId]
    ))
    return { preparedMessagesList, limitAlarms }
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

const changeParticipantPositionTransaction = async (participantCurrencyId, isReversal, amount, transferStateChange) => {
  try {
    const knex = await Db.getKnex()
    await knex.transaction(async (trx) => {
      try {
        const transactionTimestamp = Time.getUTCString(new Date())
        transferStateChange.createdDate = transactionTimestamp
        const participantPosition = await knex('participantPosition').transacting(trx).where({ participantCurrencyId }).forUpdate().select('*').first()
        let latestPosition
        if (isReversal) {
          latestPosition = participantPosition.value - amount
        } else {
          latestPosition = participantPosition.value + amount
        }
        latestPosition = parseFloat(latestPosition.toFixed(2))
        await knex('participantPosition').transacting(trx).where({ participantCurrencyId }).update({
          value: latestPosition,
          changedDate: transactionTimestamp
        })
        await knex('transferStateChange').transacting(trx).insert(transferStateChange)
        const insertedTransferStateChange = await knex('transferStateChange').transacting(trx).where({ transferId: transferStateChange.transferId }).forUpdate().first().orderBy('transferStateChangeId', 'desc')
        const participantPositionChange = {
          participantPositionId: participantPosition.participantPositionId,
          transferStateChangeId: insertedTransferStateChange.transferStateChangeId,
          value: latestPosition,
          reservedValue: participantPosition.reservedValue,
          createdDate: transactionTimestamp
        }
        await knex('participantPositionChange').transacting(trx).insert(participantPositionChange)
        await trx.commit
      } catch (err) {
        await trx.rollback
        throw err
      }
    }).catch((err) => {
      throw err
    })
  } catch (e) {
    throw e
  }
}

/**
 * @function GetByNameAndCurrency
 *
 * @async
 * @description This retuns the active position of a participant and currency combination, if currency is not passed then all the active currencies are considered
 *
 *
 * @param {string} name - the name of the participant. Example 'dfsp1'
 * @param {string} [currencyId = null] - the optional currency parameter
 *
 * @returns {array} - Returns an array containing the details of active position(s) for the participant if successful, or throws an error if failed
 */

const getByNameAndCurrency = async (name, ledgerAccountTypeId, currencyId = null) => {
  try {
    return Db.participantPosition.query(builder => {
      return builder.innerJoin('participantCurrency AS pc', 'participantPosition.participantCurrencyId', 'pc.participantCurrencyId')
        .innerJoin('participant AS p', 'pc.participantId', 'p.participantId')
        .where({
          'p.name': name,
          'p.isActive': 1,
          'pc.isActive': 1,
          'pc.ledgerAccountTypeId': ledgerAccountTypeId
        })
        .where(q => {
          if (currencyId != null) {
            return q.where('pc.currencyId', '=', currencyId)
          }
        })
        .select('participantPosition.*',
          'pc.currencyId')
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

const getAllByNameAndCurrency = async (name, currencyId = null) => {
  try {
    return Db.participantPosition.query(builder => {
      return builder.innerJoin('participantCurrency AS pc', 'participantPosition.participantCurrencyId', 'pc.participantCurrencyId')
        .innerJoin('ledgerAccountType AS lap', 'lap.ledgerAccountTypeId', 'pc.ledgerAccountTypeId')
        .innerJoin('participant AS p', 'pc.participantId', 'p.participantId')
        .where({
          'p.name': name,
          'p.isActive': 1,
          'pc.isActive': 1
        })
        .where(q => {
          if (currencyId != null) {
            return q.where('pc.currencyId', '=', currencyId)
          }
        })
        .select('participantPosition.*',
          'lap.name AS ledgerAccountType',
          'pc.currencyId'
        )
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

module.exports = {
  changeParticipantPositionTransaction,
  prepareChangeParticipantPositionTransaction,
  getByNameAndCurrency,
  getAllByNameAndCurrency
}
