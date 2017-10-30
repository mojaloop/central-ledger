'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('executedTransfers', (t) => {
    t.index('transferId')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('executedTransfers', (t) => {
    t.dropIndex('transferId')
  })
}
