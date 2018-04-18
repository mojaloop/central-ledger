'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('transferBatch', (t) => {
    t.increments('transferBatchId').primary().unsigned().defaultTo(1)
    t.timestamp('createdDate').notNullable().defaultTo(knex.fn.now())
    t.string('state', 20).nullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('transferBatch')
}
