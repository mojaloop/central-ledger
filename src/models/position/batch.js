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

let knex

const _initKnex = async () => {
  if (!knex) {
    knex = await Db.getKnex()
  }
}

const startDbTransaction = async () => {
  _initKnex()
  const trx = await knex.transaction()
  return trx
}

const getLatestTransferStatesByTransferIdList = async (transfersIdList) => {
  try {
    const latestTransferStateChanges = {}
    const results = await Db.from('transferStateChange').query(async (builder) => {
      const result = builder
        .whereIn('transferStateChange.transferId', transfersIdList)
        .orderBy('transferStateChangeId', 'desc')
      return result
    })
    results.forEach((result) => {
      if (!latestTransferStateChanges[result.transferId]) {
        latestTransferStateChanges[result.transferId] = result.transferStateId
      }
    })
    return latestTransferStateChanges
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}

const getPositionsByAccountIdsForUpdate = async (trx, accountIds) => {
  _initKnex()
  const participantPositions = await knex('participantPosition')
    .transacting(trx)
    .whereIn('participantCurrencyId', accountIds)
    .forUpdate()
    .select('*')
  const positions = {}
  participantPositions.forEach((position) => {
    positions[position.participantCurrencyId] = position
  })
  return positions
}

const getPositionsByAccountIdsNonTrx = async (accountIds) => {
  _initKnex()
  const participantPositions = await knex('participantPosition')
    .whereIn('participantCurrencyId', accountIds)
    .select('*')
  const positions = {}
  participantPositions.forEach((position) => {
    positions[position.participantCurrencyId] = position
  })
  return positions
}

const updateParticipantPosition = async (trx, participantPositionId, participantPositionValue, participantPositionReservedValue = null) => {
  _initKnex()
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

module.exports = {
  startDbTransaction,
  getLatestByTransferIdList,
  getPositionsByAccountIds,
  getPositionsByAccountIdsNonTrx,
  updateParticipantPosition
}
