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

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Config = require('./config')
const SettlementService = require('../domain/settlement')
const SettlementModel = require('../models/settlement/settlementModel')

const Db = require('./db')
const ConfigValidator = require('./configValidator')

const SETTLEMENT_MODELS_ALIASES = {
  CGS: {
    name: 'CGS',
    settlementGranularity: 'GROSS',
    settlementInterchange: 'BILATERAL',
    settlementDelay: 'IMMEDIATE',
    requireLiquidityCheck: true,
    ledgerAccountType: 'POSITION',
    autoPositionReset: false,
    settlementAccountType: 'SETTLEMENT'
  },
  DEFERREDNET: {
    name: 'DEFERREDNET',
    settlementGranularity: 'NET',
    settlementInterchange: 'MULTILATERAL',
    settlementDelay: 'DEFERRED',
    requireLiquidityCheck: true,
    ledgerAccountType: 'POSITION',
    autoPositionReset: true,
    settlementAccountType: 'SETTLEMENT'
  },
  INTERCHANGEFEE: {
    name: 'INTERCHANGEFEE',
    settlementGranularity: 'NET',
    settlementInterchange: 'MULTILATERAL',
    settlementDelay: 'DEFERRED',
    requireLiquidityCheck: false,
    ledgerAccountType: 'INTERCHANGE_FEE',
    autoPositionReset: true,
    settlementAccountType: 'INTERCHANGE_FEE_SETTLEMENT'
  }
}

/**
 * [initializeSeedData Adds configurable seeds data]
 */
async function initializeSeedData () {
  await ConfigValidator.validateConfig()
  const knex = Db.getKnex()
  return knex.transaction(async trx => {
    try {
      await initializeSettlementModels(trx)

      await trx.commit
    } catch (err) {
      await trx.rollback
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  })
}

async function initializeSettlementModels (trx) {
  const settlementModelNamesToCreate = Config.SETTLEMENT_MODELS.map(item => {
    return SETTLEMENT_MODELS_ALIASES[item].name
  })
  let existingSettlementModelsNames = await SettlementModel.getSettlementModelsByName(settlementModelNamesToCreate, trx)
  existingSettlementModelsNames = existingSettlementModelsNames.map(record => record.name)
  const missingAccountTypes = Config.SETTLEMENT_MODELS.filter(item => {
    return !existingSettlementModelsNames.includes(SETTLEMENT_MODELS_ALIASES[item].name)
  })
  if (missingAccountTypes.length > 0) {
    const recordsToCreate = missingAccountTypes.map(item => {
      return SETTLEMENT_MODELS_ALIASES[item]
    })
    await Promise.all(recordsToCreate.map(async record => {
      return SettlementService.createSettlementModel(record, trx)
    }))
  }
}

module.exports = {
  initializeSeedData
}
