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
 - Vijaya Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 ******/

/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
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
 - Shashikant Hirugade <shashi.mojaloop@gmail.com>

 * ModusBox
 - Vijaya Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 ******/

'use strict'

exports.up = async (knex) => {
  return await knex.schema.hasTable('participantPositionChange').then(async function(exists) {
    if (exists) {
      // Step 1: Add the column as nullable
      await knex.schema.alterTable('participantPositionChange', (t) => {
        t.integer('participantCurrencyId').unsigned()
      })

      // Step 2: Populate the column with participantCurrencyId from participantPosition
      await knex('participantPositionChange')
        .update({
          participantCurrencyId: knex.raw(`
            (SELECT pp.participantCurrencyId 
            FROM participantPosition pp 
            WHERE pp.participantPositionId = participantPositionChange.participantPositionId)
          `)
        })
        .whereNull('participantCurrencyId')

      // Step 3: Make it NOT NULL and add the foreign key
      // Step 3a: Make it NOT NULL
      await knex.schema.alterTable('participantPositionChange', (t) => {
        t.integer('participantCurrencyId').unsigned().notNullable().alter()
      })

      // Step 3b: Add the foreign key
      await knex.schema.alterTable('participantPositionChange', (t) => {
        t.foreign('participantCurrencyId')
          .references('participantCurrencyId')
          .inTable('participantCurrency')
      })
    }
  })
}

exports.down = async (knex) => {
  return await knex.schema.hasTable('participantPositionChange').then(function(exists) {
    if (exists) {
      return knex.schema.alterTable('participantPositionChange', (t) => {
        t.dropColumn('participantCurrencyId')
      })
    }
  })
}
