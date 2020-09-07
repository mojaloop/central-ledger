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

 * Claudio Viola <claudio.viola@modusbox.com>
 --------------
******/
'use strict'

const LedgerAccountTypeModel = require('../models/ledgerAccountType/ledgerAccountType')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Config = require('./config')
const Logger = require('@mojaloop/central-services-logger')
const LedgerAccountTypesService = require('../domain/ledgerAccountTypes')
const Db = require('./db')
const ConfigValidator = require('./configValidator')

/**
 * [initializeSeedData Adds configurable seeds data]
 */
async function initializeSeedData () {
  await ConfigValidator.validateConfig()
  const ledgerAccountTypesNamesToCreate = Config.ADDITIONAL_PARTICIPANT_LEDGER_ACCOUNT_TYPES.map(item => item.name)
  console.log(ledgerAccountTypesNamesToCreate)
  const knex = Db.getKnex()
  return knex.transaction(async trx => {
    try {
      let existingAccountTypes = await LedgerAccountTypeModel.getLedgerAccountsByName(ledgerAccountTypesNamesToCreate, trx)
      existingAccountTypes = existingAccountTypes.map(record => record.name)
      if (existingAccountTypes.length !== ledgerAccountTypesNamesToCreate.length) {
        const missingAccountTypes = Config.ADDITIONAL_PARTICIPANT_LEDGER_ACCOUNT_TYPES.filter(item => !existingAccountTypes.includes(item.name))
        const recordsToCreate = missingAccountTypes.map(item => ({
          name: item.name,
          description: item.description,
          isSettleable: true,
          isActive: true
        }))
        console.log(recordsToCreate)
        const ledgerAccountTypesIds = await LedgerAccountTypeModel.bulkInsert(recordsToCreate, trx)
        await Promise.all(ledgerAccountTypesIds.map(async ledgerAccountTypeId => {
          await LedgerAccountTypesService.createAssociatedParticipantAccounts(ledgerAccountTypeId, 'configSeeder', trx)
        }))
      }
      await trx.commit
    } catch (err) {
      await trx.rollback
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  })
}

module.exports = {
  initializeSeedData
}
