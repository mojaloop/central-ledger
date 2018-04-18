'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('transferState', (t) => {
    t.increments('transferStateId').unsigned().primary().defaultTo(1)
    t.string('name', 10).notNullable()
    t.timestamp('settledDate').notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('transferBatch')
}
