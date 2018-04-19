'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('settlement', (t) => {
    t.bigIncrements('settlementId').primary().notNullable()

    t.bigInteger('transferBatchId').unsigned().notNullable()
    t.foreign('transferBatchId').references('transferBatchId').inTable('transferBatch')

    t.string('settlementType', 16).notNullable()
    t.dateTime('settledDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('settlement')
}
