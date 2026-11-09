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

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------
 **********/

const SETTLEMENT_WINDOW_STATES = [
  'OPEN',
  'CLOSED',
]

exports.up = async (knex) => {
  await knex.schema.hasTable('metaSettlementWindow').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('metaSettlementWindow', (t) => {
        t.bigIncrements('id').primary().notNullable()
        t.string('reason', 512)
        t.datetime('openDate', { precision: 3 }).notNullable()
        t.datetime('closeDate', { precision: 3 })
        t.enu('state', SETTLEMENT_WINDOW_STATES).notNullable()
      })
    }
  })

  await knex.schema.hasTable('metaSettlement').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('metaSettlement', (t) => {
        t.bigIncrements('id').primary().notNullable()
        t.string('reason', 512)
        t.datetime('createdDate', { precision: 3 }).notNullable()
        t.integer('modelId').unsigned().notNullable()

        t.foreign('modelId').references('settlementModelId').inTable('settlementModel')
      })
    }
  })

  await knex.schema.hasTable('metaSettlementWindow_Settlement').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('metaSettlementWindow_Settlement', (t) => {
        t.bigInteger('windowId').unsigned().notNullable()
        t.bigInteger('settlementId').unsigned().notNullable()
        t.datetime('createdDate', { precision: 3 }).notNullable()

        t.primary(['windowId', 'settlementId'])
        t.foreign('windowId').references('id').inTable('metaSettlementWindow')
        t.foreign('settlementId').references('id').inTable('metaSettlement')
      })
    }
  })

  await knex.schema.hasTable('metaSettlementLeg').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('metaSettlementLeg', (t) => {
        t.bigIncrements('id').primary().notNullable()
        t.bigInteger('settlementId').unsigned().notNullable()
        t.bigInteger('windowId').unsigned().notNullable()
        t.string('dfspId').notNullable()
        t.string('currency', 3).notNullable()
        t.decimal('staging', 39, 0).unsigned().notNullable()
        t.decimal('debitPendingId', 39, 0).unsigned().notNullable()
        t.decimal('creditPendingId', 39, 0).unsigned().notNullable()

        t.foreign('settlementId').references('id').inTable('metaSettlement')
        t.foreign('windowId').references('id').inTable('metaSettlementWindow')
        t.foreign('dfspId').references('dfspId').inTable('metaDfspRoot')
        t.foreign('currency').references('currencyId').inTable('currency')
      })
    }
  })
}

exports.down = async (knex) => {
  await knex.schema.hasTable('metaSettlementLeg').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('metaSettlementLeg')
    }
  })

  await knex.schema.hasTable('metaSettlementWindow_Settlement').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('metaSettlementWindow_Settlement')
    }
  })

  await knex.schema.hasTable('metaSettlement').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('metaSettlement')
    }
  })

  await knex.schema.hasTable('metaSettlementWindow').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('metaSettlementWindow')
    }
  })
}
