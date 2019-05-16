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
  return knex.schema.hasTable('quote').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('quote', (t) => {
        t.string('quoteId', 36).primary().notNullable()
        t.string('transactionReferenceId', 36).notNullable().comment('Common ID (decided by the Payer FSP) between the FSPs for the future transaction object')
        t.foreign('transactionReferenceId').references('transactionReferenceId').inTable('transactionReference')
        t.string('transactionRequestId', 36).defaultTo(null).nullable().comment('Optional previously-sent transaction request')
        t.foreign('transactionRequestId').references('transactionReferenceId').inTable('transactionReference')
        t.text('note').defaultTo(null).nullable().comment('A memo that will be attached to the transaction')
        t.dateTime('expirationDate').defaultTo(null).nullable().comment('Optional expiration for the requested transaction')
        t.integer('transactionInitiatorId').unsigned().notNullable().comment('This is part of the transaction initiator')
        t.foreign('transactionInitiatorId').references('transactionInitiatorId').inTable('transactionInitiator')
        t.integer('transactionInitiatorTypeId').unsigned().notNullable().comment('This is part of the transaction initiator type')
        t.foreign('transactionInitiatorTypeId').references('transactionInitiatorTypeId').inTable('transactionInitiatorType')
        t.integer('transactionScenarioId').unsigned().notNullable().comment('This is part of the transaction scenario')
        t.foreign('transactionScenarioId').references('transactionScenarioId').inTable('transactionScenario')
        t.integer('balanceOfPaymentsId').unsigned().defaultTo(null).nullable().comment('This is part of the transaction type that contains the elements- balance of payment')
        t.foreign('balanceOfPaymentsId').references('balanceOfPaymentsId').inTable('balanceOfPayments')
        t.integer('transactionSubScenarioId').unsigned().defaultTo(null).nullable().comment('This is part of the transaction type sub scenario as defined by the local scheme')
        t.foreign('transactionSubScenarioId').references('transactionSubScenarioId').inTable('transactionSubScenario')
        t.integer('amountTypeId').unsigned().notNullable().comment('This is part of the transaction type that contains valid elements for - Amount Type')
        t.foreign('amountTypeId').references('amountTypeId').inTable('amountType')
        t.decimal('amount', 18, 4).notNullable().defaultTo(0).comment('The amount that the quote is being requested for. Need to be interpert in accordance with the amount type')
        t.string('currencyId').defaultTo(null).nullable().comment('Trading currency pertaining to the Amount')
        t.foreign('currencyId').references('currencyId').inTable('currency')
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable().comment('System dateTime stamp pertaining to the inserted record')
      })
    }
  })
}

exports.down = (knex, Promise) => {
  return knex.schema.dropTableIfExists('quote')
}
