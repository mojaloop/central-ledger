'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transferStateChange', (t) => {
    t.index('transferId')
    t.index('transferStateId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transferStateChange', (t) => {
    t.dropIndex('transferId')
    t.dropIndex('transferStateId')
  })
}
