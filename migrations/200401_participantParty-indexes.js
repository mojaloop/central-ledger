'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('participantParty', (t) => {
    t.index('participantId')
    t.unique(['participantId', 'partyId'])
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('participantParty', (t) => {
    t.dropIndex('participantId')
    t.dropUnique(['participantId', 'partyId'])
  })
}
