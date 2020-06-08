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
 - Deon Botha <deon.botha@modusbox.com>
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Valentin Genev <valentin.genev@modusbox.com>
 --------------
 ******/
'use strict'

const Db = require('../../lib/db')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Logger = require('@mojaloop/central-services-logger')
const Utility = require('@mojaloop/central-services-shared').Util
const location = { module: 'TransferFulfilHandler', method: '', path: '' }
const Facade = {
  updateTransferParticipantStateChange: async function (transferId, payerdfsp, payeedfsp, currency, amount, ledgerEntryType) {
    try {
      const knex = await Db.getKnex()

      return knex.transaction(async (trx) => {
        try {
          await knex.from(knex.raw('?? (??, ??, ??, ??, ??)', ['transferParticipant', 'transferId', 'participantCurrencyId', 'transferParticipantRoleTypeId', 'ledgerEntryTypeId', 'amount']))
            .transacting(trx)
            .insert(function () {
              this.select(knex.raw('?', transferId), 'PC.participantCurrencyId')
                .select(knex.raw('IFNULL (??, ??) as ??', ['T1.transferparticipantroletypeId', 'T2.transferparticipantroletypeId', 'RoleType']))
                .select('E.ledgerEntryTypeId')
                .select(knex.raw('CASE ?? WHEN ? THEN ? WHEN ? THEN ? ELSE ? END AS ??', ['P.name', payerdfsp, amount, payeedfsp, amount * -1, 0, 'amount']))
                .from('participantCurrency as PC')
                .innerJoin('participant as P', 'P.participantId', 'PC.participantId')
                .innerJoin('ledgerEntryType as E', 'E.LedgerAccountTypeId', 'PC.LedgerAccountTypeId')
                .leftOuterJoin('transferParticipantRoleType as T1', function () { this.on('P.name', '=', knex.raw('?', [payerdfsp])).andOn('T1.name', knex.raw('?', ['PAYER_DFSP'])) })
                .leftOuterJoin('transferParticipantRoleType as T2', function () { this.on('P.name', '=', knex.raw('?', [payeedfsp])).andOn('T2.name', knex.raw('?', ['PAYEE_DFSP'])) })
                .where('E.name', ledgerEntryType)
                .whereIn('P.name', [payerdfsp, payeedfsp])
                .where('PC.currencyId', currency)
            })
          await trx.commit
          return true
        } catch (err) {
          await trx.rollback
          throw ErrorHandler.Factory.reformatFSPIOPError(err)
        } finally {
          Logger.info(Utility.breadcrumb(location, { method: 'updateTransferParticipantStateChange' }))
        }
      })
    } catch (err) {
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }
}

module.exports = Facade
