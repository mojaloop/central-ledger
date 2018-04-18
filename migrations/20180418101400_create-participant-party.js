'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('participantParty', (t) => {
    t.increments('participantPartyId').primary()

    t.integer('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participantId').inTable('participant')

    t.integer('partyId').unsigned().notNullable()
    t.foreign('partyId').references('partyId').inTable('party')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('participantParty')
}
