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

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('settlementContentAggregation').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('settlementContentAggregation', (t) => {
        t.bigIncrements('settlementContentAggregationId').primary().notNullable()
        t.bigInteger('settlementWindowContentId').unsigned().notNullable()
        t.foreign('settlementWindowContentId').references('settlementWindowContentId').inTable('settlementWindowContent')
        t.integer('participantCurrencyId').unsigned().notNullable()
        t.foreign('participantCurrencyId').references('participantCurrencyId').inTable('participantCurrency')
        t.integer('transferParticipantRoleTypeId').unsigned().notNullable()
        t.foreign('transferParticipantRoleTypeId', 'sca_transferparticipantroletypeid_foreign').references('transferParticipantRoleTypeId').inTable('transferParticipantRoleType')
        t.integer('ledgerEntryTypeId').unsigned().notNullable()
        t.foreign('ledgerEntryTypeId').references('ledgerEntryTypeId').inTable('ledgerEntryType')
        t.decimal('amount', 18, 2).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
        t.string('currentStateId', 50).notNullable()
        t.foreign('currentStateId').references('settlementWindowStateId').inTable('settlementWindowState')
        t.bigInteger('settlementId').unsigned()
        t.foreign('settlementId').references('settlementId').inTable('settlement')
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settlementContentAggregation')
}
