'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('participantParty', (t) => {
    t.index('participantId')
    t.index('partyId')
    t.unique(['participantId', 'partyId'])
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('participantParty', (t) => {
    t.dropIndex('participantId')
    t.dropIndex('partyId')
    t.dropUnique(['participantId', 'partyId'])
  })
}
