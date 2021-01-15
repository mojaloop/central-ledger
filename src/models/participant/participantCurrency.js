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
 --------------
 ******/

'use strict'

const Db = require('../../lib/db')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

exports.create = async (participantId, currencyId, ledgerAccountTypeId, isActive = true) => {
  try {
    return await Db.participantCurrency.insert({
      participantId,
      currencyId,
      ledgerAccountTypeId,
      isActive,
      createdBy: 'unknown'
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.getAll = async () => {
  try {
    return Db.participantCurrency.find({}, { order: 'participantCurrencyId asc' })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.getById = async (id) => {
  try {
    return await Db.participantCurrency.findOne({ participantCurrencyId: id })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.update = async (participantCurrencyId, isActive) => {
  try {
    return await Db.participantCurrency.update({ participantCurrencyId }, { isActive })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.getByParticipantId = async (id, ledgerAccountTypeId = null) => {
  try {
    const params = { participantId: id }
    if (ledgerAccountTypeId) {
      params.ledgerAccountTypeId = ledgerAccountTypeId
    }
    return await Db.participantCurrency.find(params)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.destroyByParticipantId = async (id) => {
  try {
    return await Db.participantCurrency.destroy({ participantId: id })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.getByName = async (accountParams) => {
  try {
    const participantCurrency = await Db.participantCurrency.findOne(accountParams)
    return participantCurrency
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.createParticipantCurrencyRecords = async (participantCurrencies, trx) => {
  try {
    const knex = Db.getKnex()
    const trxFunction = async (trx, doCommit = true) => {
      try {
        await knex.batchInsert('participantCurrency', participantCurrencies)
          .transacting(trx)
        const currenciesIdsSet = new Set()
        const ledgerAccountTypeIdsSet = new Set()
        const participantIdsSet = new Set()
        participantCurrencies.forEach(participantCurrency => {
          currenciesIdsSet.add(participantCurrency.currencyId)
          ledgerAccountTypeIdsSet.add(participantCurrency.ledgerAccountTypeId)
          participantIdsSet.add(participantCurrency.participantId)
        })
        const currenciesIds = Array.from(currenciesIdsSet)
        const participantIds = Array.from(participantIdsSet)
        const ledgerAccountTypeIds = Array.from(ledgerAccountTypeIdsSet)

        const res = await knex.select('participantCurrencyId')
          .from('participantCurrency')
          .whereIn('participantId', participantIds)
          .whereIn('ledgerAccountTypeId', ledgerAccountTypeIds)
          .whereIn('currencyId', currenciesIds)
          .transacting(trx)
        if (doCommit) {
          await trx.commit
        }
        return res
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
