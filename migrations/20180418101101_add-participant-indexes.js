'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('participant', (t) => {
    t.index(['currencyId', 'name'])
    t.unique(['currencyId', 'name'])
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('participant', (t) => {
    t.dropIndex(['currencyId', 'name'])
    t.dropUnique(['currencyId', 'name'])
  })
}
