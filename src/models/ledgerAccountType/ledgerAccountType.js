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
 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Claudio Viola <claudio.viola@modusbox.com>
 --------------
 ******/
'use strict'

const Db = require('../../lib/db')
const rethrow = require('../../shared/rethrow')

/* istanbul ignore next */
exports.getLedgerAccountByName = async (name, trx = null) => {
  try {
    const knex = Db.getKnex()
    const trxFunction = async (trx) => {
      try {
        const ledgerAccountType = await knex('ledgerAccountType')
          .select()
          .where('name', name)
          .transacting(trx)
        return ledgerAccountType.length > 0 ? ledgerAccountType[0] : null
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
exports.getLedgerAccountsByName = async (names, trx = null) => {
  try {
    const knex = Db.getKnex()
    const trxFunction = async (trx) => {
      try {
        const ledgerAccountTypes = await knex('ledgerAccountType')
          .select('name')
          .whereIn('name', names)
          .transacting(trx)
        return ledgerAccountTypes
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
exports.bulkInsert = async (records, trx = null) => {
  try {
    const knex = Db.getKnex()
    const trxFunction = async (trx) => {
      try {
        await knex('ledgerAccountType')
          .insert(records)
          .transacting(trx)
        const recordsNames = records.map(record => record.name)
        const createdIds = await knex.select('ledgerAccountTypeId')
          .from('ledgerAccountType')
          .whereIn('name', recordsNames)
          .transacting(trx)
        return createdIds.map(record => record.ledgerAccountTypeId)
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

exports.create = async (name, description, isActive, isSettleable, trx = null) => {
  try {
    const knex = Db.getKnex()
    const trxFunction = async (trx) => {
      try {
        await knex('ledgerAccountType')
          .insert({
            name,
            description,
            isActive,
            isSettleable
          })
          .transacting(trx)
        const createdId = await knex.select('ledgerAccountTypeId')
          .from('ledgerAccountType')
          .where('name', name)
          .transacting(trx)
        return createdId[0].ledgerAccountTypeId
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
    return await Db.from('ledgerAccountType').find({ })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}
