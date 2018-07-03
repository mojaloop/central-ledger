'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transfer', (t) => {
    t.index('currencyId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transfer', (t) => {
    t.dropIndex('currencyId')
  })
}
