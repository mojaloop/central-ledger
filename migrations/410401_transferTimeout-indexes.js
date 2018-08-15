'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transferTimeout', (t) => {
    t.unique('transferId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transferTimeout', (t) => {
    t.dropUnique('transferId')
  })
}
