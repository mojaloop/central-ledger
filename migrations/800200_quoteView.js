/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 
 Initial contribution
 --------------------
 The initial functionality and code base was donated by the Mowali project working in conjunction with MTN and Orange as service provides.
 * Project: Mowali

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

// Notes: these changes are required for the quoting-service and are not used by central-ledger
'use strict'

exports.up = function (knex, Promise) {
  return knex.raw(`
    CREATE OR REPLACE VIEW quoteView AS
    SELECT
        q.quoteId AS quoteId,
        q.transactionReferenceId AS transactionReferenceId,
        q.transactionRequestId AS transactionRequestId,
        q.note AS note,
        q.expirationDate AS expirationDate,
        ti.name AS transactionInitiator,
        tit.name AS transactionInitiatorType,
        ts.name AS transactionScenario,
        q.balanceOfPaymentsId AS balanceOfPaymentsId,
        tss.name AS transactionSubScenario,
        amt.name AS amountType,
        q.amount AS amount,
        q.currencyId AS currency
    FROM
        quote q
        INNER JOIN transactionInitiator ti ON ti.transactionInitiatorId = q.transactionInitiatorId
        INNER JOIN transactionInitiatorType tit ON tit.transactionInitiatorTypeId = q.transactionInitiatorTypeId
        INNER JOIN transactionScenario ts ON ts.transactionScenarioId = q.transactionScenarioId
        INNER JOIN amountType amt ON amt.amountTypeId = q.amountTypeId
        LEFT JOIN transactionSubScenario tss ON tss.transactionSubScenarioId = q.transactionSubScenarioId
  `)
}

module.exports.down = async function(knex) {
  return knex.raw('DROP VIEW quoteView')
}
