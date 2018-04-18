'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('charge', (t) => {
    t.index('name')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('charge', (t) => {
    t.dropIndex('name')
  })
}
