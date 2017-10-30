'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('ledgerDomainEvents', (t) => {
    t.unique(['aggregateId', 'sequenceNumber'])
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('ledgerDomainEvents', (t) => {
    t.dropUnique(['aggregateId', 'sequenceNumber'])
  })
}
