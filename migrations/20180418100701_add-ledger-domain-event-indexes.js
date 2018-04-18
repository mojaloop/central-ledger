'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('ledgerDomainEvent', (t) => {
    t.index('name')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('ledgerDomainEvent', (t) => {
    t.dropIndex('name')
  })
}
