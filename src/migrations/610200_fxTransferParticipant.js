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

 * INFITX
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 ******/

'use strict'

exports.up = async (knex) => {
  return await knex.schema.hasTable('fxTransferParticipant').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('fxTransferParticipant', (t) => {
        t.bigIncrements('fxTransferParticipantId').primary().notNullable()
        t.string('commitRequestId', 36).notNullable()
        t.foreign('commitRequestId').references('commitRequestId').inTable('fxTransfer')
        t.integer('participantCurrencyId').unsigned().notNullable()
        t.foreign('participantCurrencyId').references('participantCurrencyId').inTable('participantCurrency')
        t.integer('transferParticipantRoleTypeId').unsigned().notNullable()
        t.foreign('transferParticipantRoleTypeId').references('transferParticipantRoleTypeId').inTable('transferParticipantRoleType')
        t.integer('ledgerEntryTypeId').unsigned().notNullable()
        t.foreign('ledgerEntryTypeId').references('ledgerEntryTypeId').inTable('ledgerEntryType')
        t.integer('fxParticipantCurrencyTypeId').unsigned()
        t.foreign('fxParticipantCurrencyTypeId').references('fxParticipantCurrencyTypeId').inTable('fxParticipantCurrencyType')
        t.decimal('amount', 18, 4).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('fxTransferParticipant')
}
