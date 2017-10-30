'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('settlements', (t) => {
    t.uuid('settlementId').primary()
    t.string('settlementType', 16).notNullable()
    t.timestamp('settledAt').notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('settlements')
}
