'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('ledgerDomainEvent', (t) => {
    t.unique(['aggregateId', 'sequenceNumber'])
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('ledgerDomainEvent', (t) => {
    t.dropUnique(['aggregateId', 'sequenceNumber'])
  })
}
