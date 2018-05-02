'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('settlement', (t) => {
    t.bigIncrements('settlementId').primary().notNullable()

    t.bigInteger('transferSettlementBatchId').unsigned().notNullable()
    t.foreign('transferSettlementBatchId').references('transferSettlementBatchId').inTable('transferSettlementBatch')

    t.string('settlementType', 16).notNullable()
    t.dateTime('settledDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settlement')
}
