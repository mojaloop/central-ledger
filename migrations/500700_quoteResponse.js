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

// Notes: these changes are required for the quoting-service and are not used by central-ledger
'use strict'

exports.up = (knex) => {
  return knex.schema.hasTable('quoteResponse').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('quoteResponse', (t) => {
        t.bigIncrements('quoteResponseId ').primary().notNullable()
        t.string('quoteId', 36).notNullable().comment('Common ID between the FSPs for the quote object, decided by the Payer FSP')
        t.foreign('quoteId').references('quoteId').inTable('quote')
        t.string('transferAmountCurrencyId', 3).notNullable().comment('CurrencyId of the transfer amount')
        t.foreign('transferAmountCurrencyId').references('currencyId').inTable('currency')
        t.decimal('transferAmount', 18, 4).notNullable().comment('The amount of money that the Payer FSP should transfer to the Payee FSP')
        t.string('payeeReceiveAmountCurrencyId', 3).defaultTo(null).nullable().comment('CurrencyId of the payee receive amount')
        t.foreign('payeeReceiveAmountCurrencyId').references('currencyId').inTable('currency')
        t.decimal('payeeReceiveAmount', 18, 4).defaultTo(null).nullable().comment('The amount of Money that the Payee should receive in the end-to-end transaction. Optional as the Payee FSP might not want to disclose any optional Payee fees')
        t.string('payeeFspFeeCurrencyId', 3).defaultTo(null).nullable().comment('CurrencyId of the payee fsp fee amount')
        t.decimal('payeeFspFeeAmount', 18, 4).defaultTo(null).nullable().comment('Payee FSP’s part of the transaction fee')
        t.string('payeeFspCommissionCurrencyId', 3).defaultTo(null).nullable().comment('CurrencyId of the payee fsp commission amount')
        t.foreign('payeeFspCommissionCurrencyId').references('currencyId').inTable('currency')
        t.decimal('payeeFspCommissionAmount', 18, 4).defaultTo(null).nullable().comment('Transaction commission from the Payee FSP')
        t.string('ilpCondition', 256).notNullable()
        t.dateTime('responseExpirationDate').defaultTo(null).nullable().comment('Optional expiration for the requested transaction')
        t.boolean('isValid').defaultTo(null).nullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable().comment('System dateTime stamp pertaining to the inserted record')
        t.comment('This table is the primary store for quote responses')
      })
    }
  })
}

exports.down = (knex) => {
  return knex.schema.dropTableIfExists('quoteResponse')
}
