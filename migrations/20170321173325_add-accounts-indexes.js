'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('accounts', (t) => {
    t.index('name')
    t.unique('name')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('accounts', (t) => {
    t.dropIndex('name')
    t.dropUnique('name')
  })
}
