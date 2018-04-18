'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('charge', (t) => {
    t.index('chargeType')
    t.unique('chargeType')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('charge', (t) => {
    t.dropIndex('chargeType')
    t.dropUnique('chargeType')
  })
}
