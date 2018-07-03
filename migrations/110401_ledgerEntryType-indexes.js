'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('ledgerEntryType', (t) => {
    t.unique('name')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('ledgerEntryType', (t) => {
    t.dropUnique('name')
  })
}
