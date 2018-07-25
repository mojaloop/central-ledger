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
    const {transferIdList, participantName, currencyId} = calculator.getListOfTransferIds(transferList)
    const abortedTransferStateChangeList = []
    const reservedTransferStateChangeList = []
    const participantCurrency = await participantFacade.getByNameAndCurrency(participantName, currencyId)
    let sumTransfersInBatch = 0
    let allTransfersMap = new Map()
    const initialTransferStateChangeList = []
    await knex.transaction(async (trx) => {
      try {
        // const initialTransferStateChangeList = await knex('transferStateChange').transacting(trx).whereIn('transferId', transferIdList).forUpdate().orderBy('transferStateChangeId', 'desc')
        for (let id of transferIdList) {
          initialTransferStateChangeList.push(await knex('transferStateChange').transacting(trx).where('transferId', id).orderBy('transferStateChangeId', 'desc').first())
        }
        let transferStateChangeMap = new Map()
        for (let transferState of initialTransferStateChangeList) {
          // if (!transferStateChangeMap.has(transferState.transferId)) {
          if (transferState.transferStateId === Enum.TransferState.RECEIVED_PREPARE) {
            transferState.transferStateChangeId = null
            transferState.transferStateId = Enum.TransferState.RESERVED
            reservedTransferStateChangeList.push(transferState)
            for (let transfer of transferList) {
              if (transfer.transferId === transferState.transferId) {
                sumTransfersInBatch += transfer.value.content.payload.amount.amount
              }
            }
            transferStateChangeMap.set(transferState.transferId, [transferState])
          } else {
            transferState.transferStateChangeId = null
            transferState.transferStateId = Enum.TransferState.ABORTED
            transferState.reason = 'Transfer in incorrect state'
            abortedTransferStateChangeList.push(transferState)
            transferStateChangeMap.set(transferState.transferId, [transferState])
          }
          // } else {
          //   let transferStateMapEntryList = transferStateChangeMap.get(transferState.transferId)
          //   const found
          //   for(let entry of transferStateMapEntryList) {
          //     const foundVal = reservedTransferStateChangeList.find(function (reservedEntry) {
          //       return reservedEntry.transferId === transferState.transferId
          //     })
          //
          //     for(let reservedEntry of reservedTransferStateChangeList){
          //       if(reservedEntry.transferId === transferState.transferId){
          //         remove entry from reservedTransferStateChangeList
          //       }
          //     }
          //     if()
          //   }
          //   transferStateChangeMap.set(transferState.transferId, transferStateMapEntryList)
          // }
        }
        const initialParticipantPosition = await knex('participantPosition').transacting(trx).where({participantCurrencyId: participantCurrency.participantCurrencyId}).forUpdate().select('*').first()
        let currentPosition = initialParticipantPosition.value
        let reservedPosition = initialParticipantPosition.reservedValue
        initialParticipantPosition.reservedValue += sumTransfersInBatch
        await knex('participantPosition').transacting(trx).where({participantPositionId: initialParticipantPosition.participantPositionId}).update(initialParticipantPosition)
        const participantLimit = await participantFacade.getParticipantLimitByParticipantCurrencyLimit(participantCurrency.participantId, participantCurrency.currencyId, Enum.limitType.NET_DEBIT_CAP)
        let availablePosition = participantLimit.value - currentPosition - reservedPosition
        let sumReserved = 0
        for (let transfer of transferList) {
          for (let transferState of reservedTransferStateChangeList) {
            if (availablePosition >= transfer.value.content.payload.amount.amount) {
              availablePosition -= transfer.value.content.payload.amount.amount
              sumReserved += transfer.value.content.payload.amount.amount
              allTransfersMap.set(transfer.value.content.payload.transferId, transferState)
            } else {
              transferState.transferStateId = Enum.TransferState.ABORTED
              transferState.reason = 'Net Debit Cap exceeded by this request at this time, please try again later'
              allTransfersMap.set(transfer.value.content.payload.transferId, transferState)
            }
          }
        }
        await knex('participantPosition').transacting(trx).where({participantPositionId: initialParticipantPosition.participantPositionId}).update({
          value: initialParticipantPosition.value + sumReserved,
          reservedValue: initialParticipantPosition.reservedValue - sumTransfersInBatch
        })
        await knex('transfer').transacting(trx).forUpdate().whereIn('transferId', transferIdList).select('*')
        await knex.batchInsert('transferStateChange', Array.from(allTransfersMap.values())).transacting(trx)
        const latestTransferStateChangesList = await knex('transferStateChange').transacting(trx).forUpdate().whereIn('transferId', transferIdList).select('*')
        let batchParticipantPositionChange = []
        for (let transferStateChange of latestTransferStateChangesList) {
          if (transferStateChange.transferStateId === Enum.TransferState.RESERVED) {
            for (let transfer of transferList) {
              currentPosition += transfer.value.content.payload.amount.amount
              sumTransfersInBatch -= transfer.value.content.payload.amount.amount
              const participantPositionChange = {
                participantPositionId: initialParticipantPosition.participantPositionId,
                transferStateChangeId: transferStateChange.transferStateChangeId,
                value: currentPosition,
                reservedValue: sumTransfersInBatch
              }
              batchParticipantPositionChange.push(participantPositionChange)
            }
          }
        }
        await knex.batchInsert('participantPositionChange', batchParticipantPositionChange).transacting(trx)
        await trx.commit
      } catch (e) {
        Logger.info(e)
        await trx.rollback
        throw e
      }
    })
    return allTransfersMap
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
