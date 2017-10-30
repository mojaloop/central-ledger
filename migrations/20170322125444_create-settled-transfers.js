'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('settledTransfers', (t) => {
    t.uuid('transferId').primary()
    t.uuid('settlementId').notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('settledTransfers')
}
