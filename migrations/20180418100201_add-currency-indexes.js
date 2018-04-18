'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('currency', (t) => {
    t.index('code')
    t.unique('code')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('currency', (t) => {
    t.dropIndex('code')
    t.dropUnique('code')
  })
}
