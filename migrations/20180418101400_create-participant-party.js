'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('participantParty', (t) => {
    t.bigIncrements('participantPartyId').unsigned().primary()
    t.big('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participant.participantId')
    t.big('partyId').unsigned().notNullable()
    t.foreign('partyId').references('party.partyId')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('participantParty')
}
