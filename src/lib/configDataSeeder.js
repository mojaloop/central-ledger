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

// const LedgerAccountTypeModel = require('../../models/ledgerAccountType/ledgerAccountType')
// const ErrorHandler = require('@mojaloop/central-services-error-handling')
// const ParticipantFacade = require('../../models/participant/facade')
// const ParticipantPosition = require('../../models/participant/participantPosition')
// const ParticipantCurrency = require('../../models/participant/participantCurrency')
// const ParticipantCurrencyCached = require('../../models/participant/participantCurrencyCached')
// const Config = require('../../lib/config')
const Logger = require('@mojaloop/central-services-logger')

// const Db = require('../../lib/db')
const ConfigValidator = require('./configValidator');


/**
 * [initializeConfigurableSeeds Adds configurable seeds data]
 */
async function initializeSeedData () {
  // try {
    await ConfigValidator.validateConfig()
  //   if (validationResult.error) {
  //     Logger.isErrorEnabled && Logger.error(validationResult.error)
  //     throw ErrorHandler.Factory.createInternalServerFSPIOPError(`Configured seed data schema is not valid: ${validationResult.error}`)
  //   }
  // // }
  // catch (err) {
  //   Logger.isErrorEnabled && Logger.error(err)
  //   // throw ErrorHandler.Factory.createInternalServerFSPIOPError(`Configured seed data schema is not valid: ${validationResult.error}`)
  // }
}

module.exports = {
  initializeSeedData
}
//     try {
//
//       const knex = Db.getKnex()
//       await knex.transaction(async trx => {
//         try {
//           const ledgerAccountTypeId = await LedgerAccountTypeModel.create(name, description, isActive, isSettleable, trx)
//           if (isSettleable === true) {
//             const nonHubParticipantWithCurrencies = await ParticipantFacade.getAllNonHubParticipantsWithCurrencies(trx)
//             const participantCurrencies = nonHubParticipantWithCurrencies.map(nonHubParticipantWithCurrency => ({
//               participantId: nonHubParticipantWithCurrency.participantId,
//               currencyId: nonHubParticipantWithCurrency.currencyId,
//               ledgerAccountTypeId: ledgerAccountTypeId,
//               isActive: true,
//               createdBy: 'ledgerAccountType'
//             }))
//             const participantCurrencyCreatedRecordIds = await ParticipantCurrency.createParticipantCurrencyRecords(participantCurrencies, trx)
//             const participantPositionRecords = participantCurrencyCreatedRecordIds.map(currencyId => ({
//               participantCurrencyId: currencyId.participantCurrencyId,
//               value: 0.0000,
//               reservedValue: 0.0000
//             }))
//             await ParticipantPosition.createParticipantPositionRecords(participantPositionRecords, trx)
//             await ParticipantCurrencyCached.invalidateParticipantCurrencyCache()
//           }
//           await trx.commit()
//         } catch (err) {
//           await trx.rollback()
//           throw ErrorHandler.Factory.reformatFSPIOPError(err)
//         }
//       })
//       return true
//     } catch (err) {
//       throw ErrorHandler.Factory.reformatFSPIOPError(err)
//     }
//   }
// }
