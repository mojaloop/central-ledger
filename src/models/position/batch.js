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

 * INFITX
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>

 --------------
 ******/

'use strict'

const Db = require('../../lib/db')
const Logger = require('@mojaloop/central-services-logger')

const startDbTransaction = async () => {
  const knex = await Db.getKnex()
  const trx = await knex.transaction()
  return trx
}

const getLatestTransferStateChangesByTransferIdList = async (trx, transfersIdList) => {
  const knex = await Db.getKnex()
  try {
    const latestTransferStateChanges = {}
    const results = await knex('transferStateChange')
      .transacting(trx)
      .whereIn('transferStateChange.transferId', transfersIdList)
      .orderBy('transferStateChangeId', 'desc')
      .select('*')

    for (const result of results) {
      if (!latestTransferStateChanges[result.transferId]) {
        latestTransferStateChanges[result.transferId] = result
      }
    }
    return latestTransferStateChanges
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}

const getAllParticipantCurrency = async (trx) => {
  const knex = await Db.getKnex()
  if (trx) {
    const result = await knex('participantCurrency')
      .transacting(trx)
      .select('*')
    return result
  } else {
    const result = await knex('participantCurrency')
      .select('*')
    return result
  }
}

const getPositionsByAccountIdsForUpdate = async (trx, accountIds) => {
  const knex = await Db.getKnex()
  const participantPositions = await knex('participantPosition')
    .transacting(trx)
    .whereIn('participantCurrencyId', accountIds)
    .forUpdate()
    .select('*')
  const positions = {}
  for (const position of participantPositions) {
    positions[position.participantCurrencyId] = position
  }
  return positions
}

const updateParticipantPosition = async (trx, participantPositionId, participantPositionValue, participantPositionReservedValue = null) => {
  const knex = await Db.getKnex()
  const optionalValues = {}
  if (participantPositionReservedValue !== null) {
    optionalValues.reservedValue = participantPositionReservedValue
  }
  return await knex('participantPosition').transacting(trx)
    .where({ participantPositionId })
    .update({
      value: participantPositionValue,
      ...optionalValues,
      changedDate: new Date()
    })
}

const getTransferInfosToChangePosition = async (trx, transferIds, transferParticipantRoleTypeId, ledgerEntryTypeId) => {
  try {
    const transferInfos = await Db.from('transferParticipant').query(async builder => {
      return builder
        .transacting(trx)
        .innerJoin('transferStateChange AS tsc', 'tsc.transferId', 'transferParticipant.transferId')
        .where({
          'transferParticipant.transferParticipantRoleTypeId': transferParticipantRoleTypeId,
          'transferParticipant.ledgerEntryTypeId': ledgerEntryTypeId
        })
        .whereIn('transferParticipant.transferId', transferIds)
        .select(
          'transferParticipant.*',
          'tsc.transferStateId',
          'tsc.reason'
        )
        .orderBy('tsc.transferStateChangeId', 'desc')
    })
    const info = {}
    // This should key the transfer info with the latest transferStateChangeId
    for (const transferInfo of transferInfos) {
      if (!(transferInfo.transferId in info)) {
        info[transferInfo.transferId] = transferInfo
      }
    }
    return info
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const bulkInsertTransferStateChanges = async (trx, transferStateChangeList) => {
  const knex = await Db.getKnex()
  return await knex.batchInsert('transferStateChange', transferStateChangeList).transacting(trx)
}

const bulkInsertParticipantPositionChanges = async (trx, participantPositionChangeList) => {
  const knex = await Db.getKnex()
  return await knex.batchInsert('participantPositionChange', participantPositionChangeList).transacting(trx)
}

module.exports = {
  startDbTransaction,
  getLatestTransferStateChangesByTransferIdList,
  getPositionsByAccountIdsForUpdate,
  updateParticipantPosition,
  bulkInsertTransferStateChanges,
  bulkInsertParticipantPositionChanges,
  getAllParticipantCurrency,
  getTransferInfosToChangePosition
}
