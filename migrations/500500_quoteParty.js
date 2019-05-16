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

exports.up = (knex, Promise) => {
  return knex.schema.hasTable('quoteParty').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('quoteParty', (t) => {
        t.bigIncrements('quotePartyId').primary().notNullable()
        t.string('quoteId', 36).notNullable().comment('Common ID between the FSPs for the quote object, decided by the Payer FSP')
        t.foreign('quoteId').references('quoteId').inTable('quote')
        t.integer('partyTypeId').unsigned().notNullable().comment('Specifies the type of party this row relates to; typically PAYER or PAYEE')
        t.foreign('partyTypeId').references('partyTypeId').inTable('partyType')
        t.integer('partyIdentifierTypeId').unsigned().notNullable().comment('Specifies the type of identifier used to identify this party e.g. MSISDN, IBAN etc...')
        t.foreign('partyIdentifierTypeId').references('partyIdentifierTypeId').inTable('partyIdentifierType')
        t.string('partyIdentifierValue', 128).notNullable().comment('The value of the identifier used to identify this party')
        t.integer('partySubIdOrTypeId').unsigned().defaultTo(null).nullable().comment('A sub-identifier or sub-type for the Party')
        t.foreign('partySubIdOrTypeId').references('partyIdentifierTypeId').inTable('partyIdentifierType')
        t.string('fspId', 255).defaultTo(null).nullable().comment('This is the FSP ID as provided in the quote. For the switch between multi-parties it is required')
        t.integer('participantId').unsigned().defaultTo(null).nullable().comment('Reference to the resolved FSP ID (if supplied/known). If not an error will be reported')
        t.foreign('participantId').references('participantId').inTable('participant')
        t.string('merchantClassificationCode', 4).defaultTo(null).nullable().comment('Used in the context of Payee Information, where the Payee happens to be a merchant accepting merchant payments')
        t.string('partyName', 128).defaultTo(null).nullable().comment('Display name of the Party, could be a real name or a nick name')
        t.integer('transferParticipantRoleTypeId').unsigned().notNullable().comment('The role this Party is playing in the transaction')
        t.foreign('transferParticipantRoleTypeId').references('transferParticipantRoleTypeId').inTable('transferParticipantRoleType')
        t.integer('ledgerEntryTypeId').unsigned().notNullable().comment('The type of financial entry this Party is presenting')
        t.foreign('ledgerEntryTypeId').references('ledgerEntryTypeId').inTable('ledgerEntryType')
        t.decimal('amount', 18, 4).notNullable()
        t.string('currencyId', 3).notNullable().comment('Trading currency pertaining to the party amount')
        t.foreign('currencyId').references('currencyId').inTable('currency')
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable().comment('System dateTime stamp pertaining to the inserted record')
      })
    }
  })
}

exports.down = (knex, Promise) => {
  return knex.schema.dropTableIfExists('quoteParty')
}
