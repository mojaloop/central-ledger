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
        transferStateChangeId: insertedTransferStateChange.transferStateChangeId
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
    let currentPosition = 0, reservedPosition = 0
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

const updateParticipantPositionBatchTransferStateParticipantPosition = async (transferList, transferStateChangeList, participantCurrencyId, participntPositionChanges, sumReserved, sumTransfersInBatch) => {
  try {
    const knex = await Db.getKnex()
    let participantPositionChangeList = []
    knex.transaction(async (trx) => {
      const currentParticipantPosition = await knex('participantPosition').transacting(trx).where({participantCurrencyId}).forUpdate().select('*')
      currentParticipantPosition.value += sumReserved
      currentParticipantPosition.reservedValue -= sumTransfersInBatch
      await knex('participantPosition').transacting(trx).update({participantCurrencyId}, currentParticipantPosition)
      for(let transfer of transferList){
        await knex.batchInsert('transferStateChange', transferStateChangeList).transacting(trx)

        const participantPosition = {

        }
      }
    }).catch((err) => {
      throw err
    })
  } catch (e) {
    throw e
  }
}

module.exports = {
  updateParticipantPositionTransferStateTransaction,
  updateParticipantPositionTransaction
}
