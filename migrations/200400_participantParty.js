'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('participantParty').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('participantParty', (t) => {
        t.bigIncrements('participantPartyId').primary().notNullable()
        t.integer('participantId').unsigned().notNullable()
        t.foreign('participantId').references('participantId').inTable('participant')
        t.bigInteger('partyId').unsigned().notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantParty')
}
