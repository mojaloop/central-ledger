'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('tokens', (t) => {
    t.index('accountId')
    t.unique('token')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('tokens', (t) => {
    t.dropIndex('accountId')
    t.dropUnique('token')
  })
}
