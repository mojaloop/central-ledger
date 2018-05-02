'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('participantParty', (t) => {
    t.bigIncrements('participantPartyId').primary().notNullable()

    t.integer('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participantId').inTable('participant')

    t.bigInteger('partyId').unsigned().notNullable()
    t.foreign('partyId').references('partyId').inTable('party')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantParty')
}
