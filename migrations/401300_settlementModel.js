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
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('settlementModel').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('settlementModel', (t) => {
        t.increments('settlementModelId').primary().notNullable()
        t.string('name', 50).notNullable()
        t.boolean('isActive').defaultTo(true).notNullable()
        t.integer('settlementGranularityId').unsigned().notNullable()
        t.foreign('settlementGranularityId').references('settlementGranularityId').inTable('settlementGranularity')
        t.integer('settlementInterchangeId').unsigned().notNullable()
        t.foreign('settlementInterchangeId').references('settlementInterchangeId').inTable('settlementInterchange')
        t.integer('settlementDelayId').unsigned().notNullable()
        t.foreign('settlementDelayId').references('settlementDelayId').inTable('settlementDelay')
        t.string('currencyId', 3).nullable()
        t.foreign('currencyId').references('currencyId').inTable('currency')
        t.boolean('requireLiquidityCheck').defaultTo(true).notNullable()
        t.integer('ledgerAccountTypeId').unsigned().notNullable()
        t.foreign('ledgerAccountTypeId').references('ledgerAccountTypeId').inTable('ledgerAccountType')
        t.boolean('autoPositionReset').defaultTo(false).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settlementModel')
}
