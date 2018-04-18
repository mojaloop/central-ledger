'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('transferStateChange', (t) => {
    t.uuid('transferId').notNullable()
    t.integer('transferStateId').notNullable()
    t.timestamp('changedDate').notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('transferStateChange')
}
