'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('transfers', (t) => {
    t.index('debitAccountId')
    t.index('creditAccountId')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('transfers', (t) => {
    t.dropIndex('debitAccountId')
    t.dropIndex('creditAccountId')
  })
}
