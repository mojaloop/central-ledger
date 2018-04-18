'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('ilp', (t) => {
    t.index('fulfillment')
    t.unique('fulfillment')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('ilp', (t) => {
    t.dropIndex('fulfillment')
    t.dropUnique('fulfillment')
  })
}
