'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('settlements', (t) => {
    t.increments('settlementId').primary().unsigned().defaultTo(1)
    t.integer('transferBatchId').unsigned().notNullable()
    t.foreign('transferBatchId').references('transferBatchId').inTable('transferBatch')
    t.string('settlementType', 16).notNullable()
    t.timestamp('settledDate').notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('settlements')
}
