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
 - James Bush <james.bush@modusbox.com>
 --------------
 ******/

'use strict'

exports.up = async (knex) => {

  /**
   * Make quoteResponseId column on quoteExtension table nullable.
   * This change comes from quote-service issue #174
   */
  return await knex.schema.hasTable('quoteExtension').then(function(exists) {
    if (exists) {
      return knex.schema.alterTable('quoteExtension', (t) => {
        t.bigInteger('quoteResponseId').unsigned().nullable().alter()
        t.string('transactionId', 36).nullable().comment('The transaction reference that is part of the initial quote').alter()
      })
    }
  })
}

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('quoteExtension')
}
