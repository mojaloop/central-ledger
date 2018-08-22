'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transferError', (t) => {
    t.index('transferStateChangeId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transferError', (t) => {
    t.dropIndex('transferStateChangeId')
  })
}
