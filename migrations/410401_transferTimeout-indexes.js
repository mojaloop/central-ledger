'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transferTimeout', (t) => {
    t.index('transferId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transferTimeout', (t) => {
    t.dropIndex('transferId')
  })
}
