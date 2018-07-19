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

 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/

'use strict'

const Db = require('../../db')
const calculator = require('./calculator')
const Enum = require('../../lib/enum')
const participantFacade = require('../participant/facade')

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
    const {transferIdList, participantName, currencyId} = calculator.getValidListOfTransferIds(transferList)
    const abortedTransferStateChangeList = []
    const participantCurrency = participantFacade.getByNameAndCurrency(participantName, currencyId)
    let sumTransfersInBatch = 0
    knex.transaction(async (trx) => {
      try {
        const initialTransferStateChangeList = await knex('transferStateChange').transacting(trx).whereIn(transferIdList).forUpdate().first()
        for (let transferState of initialTransferStateChangeList) {
          if (transferState.transferStateId === Enum.TransferState.RECEIVED_PREPARE) {
            transferState.transferStateChangeId = null
            transferState.transferStateId = Enum.TransferState.RESERVED
            for (let transfer of transferList) {
              if (transfer.transferId === transferState.transferId) {
                sumTransfersInBatch += transfer.amount.amount
                transfer.transferState = transferState
              }
            }
          } else {
            transferState.transferStateChangeId = null
            transferState.transferStateId = Enum.TransferState.FAILED
            transferState.reason = 'Transfer in incorrect state'
            abortedTransferStateChangeList.push(transferState)
          }
        }
        const initialParticipantPosition = await knex('participantPosition').transacting(trx).where({participantCurrencyId: participantCurrency.participantCurrencyId}).forUpdate().first()
        let currentPosition = initialParticipantPosition.value
        let reservedPosition = initialParticipantPosition.reservedValue
        initialParticipantPosition.reservedValue += sumTransfersInBatch
        await knex('participantPosition').transacting(trx).where({participantPositionId: initialParticipantPosition.participantPositionId}).update(initialParticipantPosition)
        const participantLimit = participantFacade.getParticipantLimitByParticipantCurrencyLimit(participantCurrency.participantId, participantCurrency.currencyId, Enum.limitType.NET_DEBIT_CAP)
        let availablePosition = participantLimit.participantLimit.value - currentPosition - reservedPosition
        let batchTransferStateChange = []
        let abortedBatchTransferChange = []
        let sumReserved = 0
        for (let transfer of transferList) {
          if (availablePosition >= transfer.amount.amount) {
            availablePosition -= transfer.amount.amount
            sumReserved += transfer.amount.amount
            batchTransferStateChange.push(transfer.transferState)
          } else {
            transfer.transferState.transferStateId = Enum.TransferState.ABORTED
            transfer.transferState.reason = 'Net Debit Cap exceeded by this request at this time, please try again later'
            abortedBatchTransferChange.push(transfer.transferState)
          }
        }
        await knex('participantPosition').transacting(trx).where({participantPositionId: initialParticipantPosition.participantPositionId}).update({value: sumReserved, reservedValue: initialParticipantPosition.reservedValue - sumTransfersInBatch})
        await knex('transfer').transacting(trx).forUpdate().whereIn(transferIdList).select('*')
        await knex.batchInsert('transferStateChange', batchTransferStateChange.concat(abortedBatchTransferChange)).transacting(trx)
        const latestTransferStateChangesList = knex('transferStateChange').transacting(trx).forUpdate().whereIn(transferIdList).select('*')
        let batchParticipantPositionChange = []
        for (let transferStateChange of latestTransferStateChangesList) {
          if (transferStateChange.transferStateId === Enum.TransferState.RESERVED) {
            for (let transfer of transferList) {
              currentPosition += transfer.amount.amount
              sumTransfersInBatch -= transfer.amount.amount
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
        await trx.rollback
      }
    })
  } catch (e) {
    throw e
  }
}

module.exports = {
  updateParticipantPositionTransferStateTransaction,
  updateParticipantPositionTransaction,
  prepareChangeParticipantPositionTransaction
}
