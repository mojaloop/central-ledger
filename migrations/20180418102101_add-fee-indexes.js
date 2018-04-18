'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('fee', (t) => {
    t.index('feeId')
    t.unique('feeId')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('fee', (t) => {
    t.dropIndex('feeId')
    t.dropUnique('feeId')
  })
}
