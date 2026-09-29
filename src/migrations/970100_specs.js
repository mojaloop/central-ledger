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

exports.up = async (knex) => {
  await knex.schema.hasTable('specCurrencyLedger').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('specCurrencyLedger', (t) => {
        t.string('currency', 3).primary().notNullable()
        t.integer('ledgerOperation').unsigned().notNullable()
        t.integer('ledgerControl').unsigned().notNullable()
        t.bigIncrements('settlementBalance').notNullable()
        t.integer('assetScale').unsigned().notNullable()

        t.foreign('currency').references('currencyId').inTable('currency')
      })
    }
  })

  await knex.schema.hasTable('specCurrencyAccount').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('specCurrencyAccount', (t) => {
        t.increments('id').primary().notNullable()
        t.string('currency', 3).notNullable()
        t.string('accountType').notNullable()
        t.dateTime('createdDate').notNullable()
        t.dateTime('changedDate').notNullable()
        t.unique(['currency', 'accountType'])
        t.foreign('currency').references('currencyId').inTable('currency')
      })
    }
  })

  await knex.schema.hasTable('specDfsp').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('specDfsp', (t) => {
        t.string('dfspId').primary().notNullable()
        t.bigInteger('masterAccountId').unsigned().notNullable().unique()
      })
    }
  })

  await knex.schema.hasTable('specDfspCurrency').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('specDfspCurrency', (t) => {
        t.string('dfspId').notNullable()
        t.string('currency', 3).notNullable()
        t.bigInteger('deposit').unsigned().notNullable()
        t.bigInteger('unrestricted').unsigned().notNullable()
        t.bigInteger('unrestrictedLock').unsigned().notNullable()
        t.bigInteger('restricted').unsigned().notNullable()
        t.bigInteger('reserved').unsigned().notNullable()
        t.bigInteger('commitedOutgoing').unsigned().notNullable()
        t.bigInteger('clearingCredit').unsigned().notNullable()
        t.bigInteger('clearingSetup').unsigned().notNullable()
        t.bigInteger('clearingLimit').unsigned().notNullable()

        t.primary(['dfspId', 'currency'])
        t.foreign('dfspId').references('dfspId').inTable('specDfsp')
        t.foreign('currency').references('currencyId').inTable('currency')
      })
    }
  })

  await knex.schema.hasTable('specTransfer').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('specTransfer', (t) => {
        t.string('id', 36).primary().notNullable()
        t.string('payerId', 256).notNullable()
        t.string('payeeId', 256).notNullable()
        t.string('ilpCondition', 256).notNullable()
        t.text('ilpPacket').notNullable()
        t.string('amount', 16).notNullable()
        t.string('currency', 3).notNullable()
        t.dateTime('expiration').notNullable()
        t.string('fulfilment', 256)
        
        t.foreign('payerId').references('dfspId').inTable('specDfsp')
        t.foreign('payeeId').references('dfspId').inTable('specDfsp')
        t.foreign('currency').references('currencyId').inTable('currency')

      })
    }
  })
}

exports.down = async (knex) => {
  await knex.schema.hasTable('specCurrencyLedger').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('specCurrencyLedger')
    }
  })

  await knex.schema.hasTable('specDfspCurrency').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('specDfspCurrency')
    }
  })

  await knex.schema.hasTable('specDfsp').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('specDfsp')
    }
  })

  await knex.schema.hasTable('specCurrencyAccount').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('specCurrencyAccount')
    }
  })

  await knex.schema.hasTable('specCurrencyLedger').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('specCurrencyLedger')
    }
  })
}
