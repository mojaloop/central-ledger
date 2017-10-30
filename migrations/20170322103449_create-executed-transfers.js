'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('executedTransfers', (t) => {
    t.uuid('transferId').primary().notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('executedTransfers')
}
