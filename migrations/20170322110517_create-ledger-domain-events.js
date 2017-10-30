'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('ledgerDomainEvents', (t) => {
    t.uuid('eventId').primary()
    t.string('name', 128).notNullable()
    t.jsonb('payload').notNullable()
    t.uuid('aggregateId').notNullable()
    t.string('aggregateName', 128).notNullable()
    t.smallint('sequenceNumber').notNullable()
    t.timestamp('timestamp').notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('ledgerDomainEvents')
}
