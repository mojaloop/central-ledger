'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('ledgerDomainEvent', (t) => {
    t.string('eventId', 36).primary()
    t.string('name', 128).notNullable()
    t.json('payload').notNullable()
    t.string('aggregateId', 36).notNullable()
    t.string('aggregateName', 128).notNullable()
    t.integer('sequenceNumber').notNullable()
    t.dateTime('timestamp').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('ledgerDomainEvent')
}
