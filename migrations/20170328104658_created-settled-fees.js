'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('settledFees', (t) => {
    t.integer('feeId').primary()
    t.uuid('settlementId').notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('settledFees')
}
