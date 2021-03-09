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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Lazola Lucas <lazola.lucas@modusbox.com>
 --------------
 ******/
'use strict'

const Db = require('../../lib/db')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

/* istanbul ignore next */
exports.create = async (name, isActive, settlementGranularityId, settlementInterchangeId, settlementDelayId, currencyId, requireLiquidityCheck, ledgerAccountTypeId, settlementAccountTypeId, autoPositionReset, trx = null) => {
  try {
    const knex = Db.getKnex()
    const trxFunction = async (trx, doCommit = true) => {
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
        if (doCommit) {
          await trx.commit
        }
      } catch (err) {
        if (doCommit) {
          await trx.rollback
        }
        throw ErrorHandler.Factory.reformatFSPIOPError(err)
      }
    }
    if (trx) {
      return trxFunction(trx, false)
    } else {
      return knex.transaction(trxFunction)
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
        if (doCommit) {
          await trx.commit
        }
        return result.length > 0 ? result[0] : null
      } catch (err) {
        if (doCommit) {
          await trx.rollback
        }
        throw ErrorHandler.Factory.reformatFSPIOPError(err)
      }
    }
    if (trx) {
      return trxFunction(trx, false)
    } else {
      return knex.transaction(trxFunction)
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
exports.getAll = async () => {
  try {
    return await Db.from('settlementModel').find()
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
exports.update = async (settlementModel, isActive) => {
  try {
    return await Db.from('settlementModel').update({ settlementModelId: settlementModel.settlementModelId }, { isActive })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/* istanbul ignore next */
exports.getSettlementModelsByName = async (names, trx = null) => {
  try {
    const knex = Db.getKnex()
    const trxFunction = async (trx, doCommit = true) => {
      try {
        const settlementModelNames = knex('settlementModel')
          .select('name')
          .whereIn('name', names)
          .transacting(trx)
        if (doCommit) {
          await trx.commit
        }
        return settlementModelNames
      } catch (err) {
        if (doCommit) {
          await trx.rollback
        }
        throw ErrorHandler.Factory.reformatFSPIOPError(err)
      }
    }
    if (trx) {
      return trxFunction(trx, false)
    } else {
      return knex.transaction(trxFunction)
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
