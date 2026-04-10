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
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/
'use strict'

const Db = require('../../lib/db')

const Facade = {
  getApplicableByWindowIdList: async function (idList, settlementModel, winStateEnum) {
    const knex = await Db.getKnex()
    return Db.from('settlementWindow').query(builder => {
      const b = builder
        .join('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId')
        .join('settlementWindowContent AS swc', 'swc.settlementWindowId', 'settlementWindow.settlementWindowId')
        .join('settlementWindowContentStateChange AS swcsc', 'swcsc.settlementWindowContentStateChangeId', 'swc.currentStateChangeId')
        .whereRaw(`settlementWindow.settlementWindowId IN (${idList})`)
        .where('swc.ledgerAccountTypeId', settlementModel.ledgerAccountTypeId)
        .where('swc.currencyId', knex.raw('COALESCE(?, swc.currencyId)', settlementModel.currencyId))
        .whereIn('swsc.settlementWindowStateId', [winStateEnum.CLOSED, winStateEnum.ABORTED, winStateEnum.PENDING_SETTLEMENT])
        .whereIn('swcsc.settlementWindowStateId', [winStateEnum.CLOSED, winStateEnum.ABORTED])
        .distinct('swc.settlementWindowContentId')
      return b
    })
  },
  getBySettlementId: async (id) => {
    const knex = await Db.getKnex()
    return knex('settlementWindowContent AS swc')
      .join('settlementWindowContentStateChange AS swcsc', 'swcsc.settlementWindowContentStateChangeId', 'swc.currentStateChangeId')
      .join('ledgerAccountType AS lat', 'lat.ledgerAccountTypeId', 'swc.ledgerAccountTypeId')
      .where('swc.settlementId', id)
      .select('swc.settlementWindowContentId AS id', 'swc.settlementWindowId', 'swcsc.settlementWindowStateId AS state',
        'lat.name AS ledgerAccountType', 'swc.currencyId', 'swc.createdDate', 'swcsc.createdDate AS changedDate')
  },
  getBySettlementWindowId: async (id) => {
    const knex = await Db.getKnex()
    return knex('settlementWindowContent AS swc')
      .join('settlementWindowContentStateChange AS swcsc', 'swcsc.settlementWindowContentStateChangeId', 'swc.currentStateChangeId')
      .join('ledgerAccountType AS lat', 'lat.ledgerAccountTypeId', 'swc.ledgerAccountTypeId')
      .where('swc.settlementWindowId', id)
      .select('swc.settlementWindowContentId AS id', 'swcsc.settlementWindowStateId AS state',
        'lat.name AS ledgerAccountType', 'swc.currencyId', 'swc.createdDate', 'swcsc.createdDate AS changedDate', 'swc.settlementId')
  },
  getBySettlementAndWindowId: async (settlementId, settlementWindowId) => {
    const knex = await Db.getKnex()
    return knex('settlementWindowContent AS swc')
      .join('settlementWindowContentStateChange AS swcsc', 'swcsc.settlementWindowContentStateChangeId', 'swc.currentStateChangeId')
      .join('ledgerAccountType AS lat', 'lat.ledgerAccountTypeId', 'swc.ledgerAccountTypeId')
      .where({ 'swc.settlementId': settlementId, 'swc.settlementWindowId': settlementWindowId })
      .select('swc.settlementWindowContentId AS id', 'swc.settlementWindowId', 'swcsc.settlementWindowStateId AS state',
        'lat.name AS ledgerAccountType', 'swc.currencyId', 'swc.createdDate', 'swcsc.createdDate AS changedDate')
  }
}

module.exports = Facade
