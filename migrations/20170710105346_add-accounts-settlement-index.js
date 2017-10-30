'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('accountsSettlement', (t) => {
    t.unique('accountId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('accountsSettlement', (t) => {
    t.dropUnique('accountId')
  })
}
