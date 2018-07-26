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
 --------------
 ******/

'use strict'

const Db = require('../../db')
const calculator = require('./calculator')
const Enum = require('../../lib/enum')
const participantFacade = require('../participant/facade')
const Logger = require('@mojaloop/central-services-shared').Logger

const updateParticipantPositionTransferStateTransaction = async (participantCurrencyId, isIncrease, amount, transferStateChange) => {
  try {
    const knex = await Db.getKnex()
    knex.transaction(async (trx) => {
      const participantPosition = await knex('participantPosition').transacting(trx).where({participantCurrencyId}).forUpdate().select('*')
      let latestPosition
      if (isIncrease) {
        latestPosition = participantPosition.value + amount
      } else {
        latestPosition = participantPosition - amount
      }
      await knex('participantPosition').transacting(trx).update({participantCurrencyId}, {value: latestPosition})
      await knex('transferStateChange').transacting(trx).insert(transferStateChange)
      const insertedTransferStateChange = await knex('transferStateChange').transacting(trx).where({transferId: transferStateChange.transferId}).forUpdate().first().orderBy('transferStateChangeId', 'desc')
      const participantPositionChange = {
        participantPositionId: participantPosition.participantPositionId,
        transferStateChangeId: insertedTransferStateChange.transferStateChangeId,
        value: latestPosition,
        reservedValue: participantPosition.reservedValue,
        createdDate: new Date()
      }
      await knex('participantPositionChange').transacting(trx).insert(participantPositionChange)
        .then(trx.commit)
        .catch(trx.rollback)
    }).catch((err) => {
      throw err
    })
  } catch (e) {
    throw e
  }
}

const updateParticipantPositionTransaction = async (participantCurrencyId, sumInTransferBatch) => {
  try {
    const knex = await Db.getKnex()
    let participantPosition = {}
    let currentPosition = 0
    let reservedPosition = 0
    knex.transaction(async (trx) => {
      participantPosition = await knex('participantPosition').transacting(trx).where({participantCurrencyId}).forUpdate().select('*')
      currentPosition = participantPosition.value
      reservedPosition = participantPosition.reservedValue
      participantPosition.reservedValue = reservedPosition + sumInTransferBatch
      await knex('participantPosition').transacting(trx).update({participantPosition})
        .then(trx.commit)
        .catch(trx.rollback)
    }).catch((err) => {
      throw err
    })
    return {
      currentPosition,
      reservedPosition
    }
  } catch (e) {
    throw e
  }
}

const prepareChangeParticipantPositionTransaction = async (transferList) => {
  try {
    const knex = await Db.getKnex()
    const participantName = transferList[0].value.content.payload.payeeFsp
    const currencyId = transferList[0].value.content.payload.amount.currency
    const participantCurrency = await participantFacade.getByNameAndCurrency(participantName, currencyId)
    const abortedTransfers = {}
    const reservedTransfers = {}
    let sumTransfersInBatch = 0
    const initialTransferStateChangePromises = []
    let transferIdList = []

    await knex.transaction(async (trx) => {
      try {
        for (let transfer of transferList) {
        // const initialTransferStateChangeList = await knex('transferStateChange').transacting(trx).whereIn('transferId', transferIdList).forUpdate().orderBy('transferStateChangeId', 'desc')
        // ^^^^^ this is how we want to get this later to reduce the DB queries into one.
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
            reservedTransfers[transfer.transferId] = { transferState, transfer, rawMessage }
            sumTransfersInBatch += parseFloat(transfer.amount.amount)
          } else {
            transferState.transferStateChangeId = null
            transferState.transferStateId = Enum.TransferState.ABORTED
            transferState.reason = 'Transfer in incorrect state'
            abortedTransfers[transfer.transferId] = { transferState, transfer, rawMessage }
          }
        }
        const initialParticipantPosition = await knex('participantPosition').transacting(trx).where({participantCurrencyId: participantCurrency.participantCurrencyId}).forUpdate().select('*').first()
        let currentPosition = parseFloat(initialParticipantPosition.value)
        let reservedPosition = parseFloat(initialParticipantPosition.reservedValue)
        let effectivePosition = currentPosition + reservedPosition
        initialParticipantPosition.reservedValue += sumTransfersInBatch
        await knex('participantPosition').transacting(trx).where({participantPositionId: initialParticipantPosition.participantPositionId}).update(initialParticipantPosition)
        const participantLimit = await participantFacade.getParticipantLimitByParticipantCurrencyLimit(participantCurrency.participantId, participantCurrency.currencyId, Enum.limitType.NET_DEBIT_CAP)
        let availablePosition = participantLimit.value - effectivePosition
        let sumReserved = 0
        let batchParticipantPositionChange = []
        for (let transferId in reservedTransfers) {
          let { transfer, transferState } = reservedTransfers[transferId]
          if (availablePosition >= parseFloat(transfer.amount.amount)) {
            availablePosition -= parseFloat(transfer.amount.amount)
            sumReserved += parseFloat(transfer.amount.amount)
          } else {
            transferState.transferStateId = Enum.TransferState.ABORTED
            transferState.reason = 'Net Debit Cap exceeded by this request at this time, please try again later'
            abortedTransfers[transferId] = reservedTransfers[transferId]
            delete reservedTransfers[transferId]
          }
        }
        await knex('participantPosition').transacting(trx).where({participantPositionId: initialParticipantPosition.participantPositionId}).update({
          value: initialParticipantPosition.value + sumReserved,
          reservedValue: initialParticipantPosition.reservedValue - sumTransfersInBatch
        })
        await knex('transfer').transacting(trx).forUpdate().whereIn('transferId', transferIdList).select('*')
        let reservedTransferStateChangeList = Object.keys(reservedTransfers).length && Array.from(transferIdList.map(transferId => reservedTransfers[transferId].transferState))
        let abortedTransferStateChangeList = Object.keys(abortedTransfers).length && Array.from(transferIdList.map(transferId => abortedTransfers[transferId].transferState))
        let reservedTransferStateChangeIdList = Object.keys(reservedTransferStateChangeList).length && await knex.batchInsert('transferStateChange', reservedTransferStateChangeList).transacting(trx)
        Object.keys(abortedTransferStateChangeList).length && await knex.batchInsert('transferStateChange', abortedTransferStateChangeList).transacting(trx)
        let reservedTransfersKeysList = Object.keys(reservedTransfers)
        for (let keyIndex in reservedTransfersKeysList) {
          let { transfer } = reservedTransfers[reservedTransfersKeysList[keyIndex]]
          currentPosition += parseFloat(transfer.amount.amount)
          sumTransfersInBatch -= parseFloat(transfer.amount.amount)
          const participantPositionChange = {
            participantPositionId: initialParticipantPosition.participantPositionId,
            transferStateChangeId: reservedTransferStateChangeIdList[keyIndex],
            value: currentPosition,
            reservedValue: sumTransfersInBatch
          }
          batchParticipantPositionChange.push(participantPositionChange)
        }
        batchParticipantPositionChange.length && await knex.batchInsert('participantPositionChange ', batchParticipantPositionChange).transacting(trx)
        await trx.commit
      } catch (e) {
        Logger.info(e)
        await trx.rollback
        throw e
      }
    })
    return Array.from(transferIdList.map(transferId =>
      transferId in reservedTransfers
        ? reservedTransfers[transferId]
        : abortedTransfers[transferId]
    ))
  } catch (e) {
    Logger.info(e)
    throw e
  }
}

const changeParticipantPositionTransaction = async (participantCurrencyId, isIncrease, amount, transferStateChange) => {
  try {
    const knex = await Db.getKnex()
    await knex.transaction(async (trx) => {
      try {
        const transactionTimestamp = new Date()
        transferStateChange.createdDate = transactionTimestamp
        const participantPosition = await knex('participantPosition').transacting(trx).where({participantCurrencyId}).forUpdate().select('*').first()
        let latestPosition
        if (isIncrease) {
          latestPosition = participantPosition.value + amount
        } else {
          latestPosition = participantPosition.value - amount
        }
        latestPosition = parseFloat(latestPosition.toFixed(2))
        await knex('participantPosition').transacting(trx).where({participantCurrencyId}).update({
          value: latestPosition,
          changedDate: transactionTimestamp
        })
        await knex('transferStateChange').transacting(trx).insert(transferStateChange)
        const insertedTransferStateChange = await knex('transferStateChange').transacting(trx).where({transferId: transferStateChange.transferId}).forUpdate().first().orderBy('transferStateChangeId', 'desc')
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

module.exports = {
  changeParticipantPositionTransaction,
  updateParticipantPositionTransferStateTransaction,
  updateParticipantPositionTransaction,
  prepareChangeParticipantPositionTransaction
}
