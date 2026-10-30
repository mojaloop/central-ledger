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
  await knex.schema.hasTable('metaCurrencyConfig').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('metaCurrencyConfig', (t) => {
        t.string('currency', 3).primary().notNullable()
        t.integer('ledgerOperation').unsigned().notNullable()
        t.integer('ledgerControl').unsigned().notNullable()
        t.bigIncrements('settlementBalance').notNullable()
        t.integer('assetScale').notNullable()
        t.foreign('currency').references('currencyId').inTable('currency')
      })
    }
  })

  await knex.schema.hasTable('metaLegacyHubCurrency').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('metaLegacyHubCurrency', (t) => {
        t.bigInteger('id').primary().notNullable()
        t.string('currency', 3).notNullable()
        t.string('accountType').notNullable()
        t.dateTime('createdDate').notNullable()
        t.dateTime('changedDate').notNullable()
        t.unique(['currency', 'accountType'])
        t.foreign('currency').references('currencyId').inTable('currency')
      })
    }
  })

  await knex.schema.hasTable('metaDfspRoot').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('metaDfspRoot', (t) => {
        t.string('dfspId').primary().notNullable()
        t.bigInteger('id').unsigned().notNullable().unique()
        t.boolean('isProxy').notNullable()
      })
    }
  })

  await knex.schema.hasTable('metaDfspCurrency').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('metaDfspCurrency', (t) => {
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
        t.bigInteger('control').unsigned().notNullable()
        t.bigInteger('netDebitCap').unsigned().notNullable()
        t.bigInteger('netDebitCapSet').unsigned().notNullable()
        t.bigInteger('netDebitCapSetUtil').unsigned().notNullable()
        t.dateTime('createdDate').notNullable()
        t.dateTime('changedDatePosition').notNullable()
        t.dateTime('changedDateSettlement').notNullable()
        t.dateTime('changedDate').notNullable()

        t.primary(['dfspId', 'currency'])
        t.foreign('dfspId').references('dfspId').inTable('metaDfspRoot') 
        t.foreign('currency').references('currencyId').inTable('currency')
      })
    }
  })

  await knex.schema.hasTable('metaPayment').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('metaPayment', (t) => {
        t.string('id', 36).primary().notNullable()
        t.string('payerId', 256).notNullable()
        t.string('payeeId', 256).notNullable()
        t.enu('payerLocation', ['local', 'proxy'])
        t.enu('payeeLocation', ['local', 'proxy'])
        t.string('ilpCondition', 256).notNullable()
        t.text('ilpPacket').notNullable()
        t.string('amount', 16).notNullable()
        t.string('currency', 3).notNullable()
        t.dateTime('expiration').notNullable()

        t.foreign('payerId').references('dfspId').inTable('metaDfspRoot')
        t.foreign('payeeId').references('dfspId').inTable('metaDfspRoot')
        t.foreign('currency').references('currencyId').inTable('currency')
      })
    }
  })

  await knex.schema.hasTable('metaPrepare').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('metaPrepare', (t) => {
        t.string('id', 36).primary().notNullable()
        t.integer('payloadHash').notNullable()
        t.dateTime('abortedAt')
      })
    }
  })

  await knex.schema.hasTable('metaFulfil').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('metaFulfil', (t) => {
        t.string('id', 36).primary().notNullable()
        t.integer('payloadHash').notNullable()
        t.dateTime('abortedAt')
        t.dateTime('fulfiledAt')
        t.string('fulfilment', 256)
      })
    }
  })
}

exports.down = async (knex) => {
  await knex.schema.hasTable('metaTransfer').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('metaTransfer')
    }
  })

  await knex.schema.hasTable('metaPrepare').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('metaPrepare')
    }
  })

  await knex.schema.hasTable('metaFulfil').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('metaFulfil')
    }
  })

  await knex.schema.hasTable('metaCurrencyConfig').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('metaCurrencyConfig')
    }
  })

  await knex.schema.hasTable('metaDfspCurrency').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('metaDfspCurrency')
    }
  })

  await knex.schema.hasTable('metaDfspRoot').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('metaDfspRoot')
    }
  })

  await knex.schema.hasTable('metaLegacyHubCurrency').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('metaLegacyHubCurrency')
    }
  })

  await knex.schema.hasTable('metaCurrencyLedger').then(function (exists) {
    if (exists) {
      return knex.schema.dropTableIfExists('metaCurrencyLedger')
    }
  })
}
