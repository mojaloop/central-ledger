/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
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

 * Infitx
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 - Kevin Leyow <kevin.leyow@infitx.com>
 - Kalin Krustev <kalin.krustev@infitx.com>
 - Steven Oderayi <steven.oderayi@infitx.com>
 - Eugen Klymniuk <eugen.klymniuk@infitx.com>

 --------------

 ******/
// Notes: these changes are required for the quoting-service and are not used by central-ledger
'use strict'

exports.up = (knex) => {
  return knex.schema.hasTable('fxQuoteError').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('fxQuoteError', (t) => {
        t.bigIncrements('fxQuoteErrorId').primary().notNullable()
        t.string('conversionRequestId', 36).notNullable()
        t.foreign('conversionRequestId').references('conversionRequestId').inTable('fxQuote')
        t.bigInteger('fxQuoteResponseId').unsigned().defaultTo(null).nullable().comment('The response to the initial fxQuote')
        t.foreign('fxQuoteResponseId').references('fxQuoteResponseId').inTable('fxQuoteResponse')
        t.integer('errorCode').unsigned().notNullable()
        t.string('errorDescription', 128).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = (knex) => {
  return knex.schema.dropTableIfExists('quoteError')
}
