'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('settledFee', (t) => {
    t.index('settlementId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('settledFee', (t) => {
    t.dropIndex('settlementId')
  })
}
