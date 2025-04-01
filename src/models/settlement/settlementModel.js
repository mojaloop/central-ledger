/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
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
 - Lazola Lucas <lazola.lucas@modusbox.com>
 --------------
 ******/
'use strict'

const Db = require('../../lib/db')
const rethrow = require('../../shared/rethrow')

/* istanbul ignore next */
exports.create = async (name, isActive, settlementGranularityId, settlementInterchangeId, settlementDelayId, currencyId, requireLiquidityCheck, ledgerAccountTypeId, settlementAccountTypeId, autoPositionReset, trx = null) => {
  try {
    const knex = Db.getKnex()
    const trxFunction = async (trx) => {
      try {
        await knex('settlementModel')
          .insert({
            name,
            isActive,
            settlementGranularityId,
            settlementInterchangeId,
            settlementDelayId,
            currencyId,
            requireLiquidityCheck,
            ledgerAccountTypeId,
            settlementAccountTypeId,
            autoPositionReset
          })
          .transacting(trx)
      } catch (err) {
        rethrow.rethrowDatabaseError(err)
      }
    }
    if (trx) {
      return trxFunction(trx)
    } else {
      return knex.transaction(trxFunction)
    }
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}
/* istanbul ignore next */
exports.getByName = async (name, trx = null) => {
  try {
    const knex = Db.getKnex()
    const trxFunction = async (trx, doCommit = true) => {
      try {
        const result = await knex('settlementModel')
          .select()
          .where('name', name)
          .transacting(trx)
        return result.length > 0 ? result[0] : null
      } catch (err) {
        rethrow.rethrowDatabaseError(err)
      }
    }
    if (trx) {
      return trxFunction(trx)
    } else {
      return knex.transaction(trxFunction)
    }
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}
exports.getAll = async () => {
  try {
    return await Db.from('settlementModel').find({ isActive: 1 })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}
exports.update = async (settlementModel, isActive) => {
  try {
    return await Db.from('settlementModel').update({ settlementModelId: settlementModel.settlementModelId }, { isActive })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

/* istanbul ignore next */
exports.getSettlementModelsByName = async (names, trx = null) => {
  try {
    const knex = Db.getKnex()
    const trxFunction = async (trx) => {
      try {
        const settlementModelNames = knex('settlementModel')
          .select('name')
          .whereIn('name', names)
          .transacting(trx)
        return settlementModelNames
      } catch (err) {
        rethrow.rethrowDatabaseError(err)
      }
    }
    if (trx) {
      return trxFunction(trx)
    } else {
      return knex.transaction(trxFunction)
    }
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}
