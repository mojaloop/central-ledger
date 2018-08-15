'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('settlementStateChange', (t) => {
    t.index('settlementId')
    t.index('settlementStateId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('settlementStateChange', (t) => {
    t.dropIndex('settlementId')
    t.dropIndex('settlementStateId')
  })
}
