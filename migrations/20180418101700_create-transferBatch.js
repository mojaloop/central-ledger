'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('transferBatch', (t) => {
    t.increments('transferBatchId').primary()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
    t.string('state', 20).nullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('transferBatch')
}
