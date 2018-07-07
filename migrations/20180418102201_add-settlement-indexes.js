'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('settlement', (t) => {
    t.index('settlementWindowId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('settlement', (t) => {
    t.dropIndex('settlementWindowId')
  })
}
