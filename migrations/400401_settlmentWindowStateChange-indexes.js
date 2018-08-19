'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('settlementWindowStateChange', (t) => {
    t.index('settlementWindowId')
    t.index('settlementWindowStateId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('settlementWindowStateChange', (t) => {
    t.dropIndex('settlementWindowId')
    t.dropIndex('settlementWindowStateId')
  })
}
