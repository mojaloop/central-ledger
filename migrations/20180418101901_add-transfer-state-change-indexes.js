'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('transferStateChange', (t) => {
    t.index('transferId')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('transferStateChange', (t) => {
    t.dropIndex('transferId')
  })
}
