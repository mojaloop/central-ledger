'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('participantLimit', (t) => {
    t.index('participantCurrencyId')
    t.index('participantLimitTypeId')
    t.index('startAfterParticipantPositionChangeId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('participantLimit', (t) => {
    t.dropIndex('participantCurrencyId')
    t.dropIndex('participantLimitTypeId')
    t.dropIndex('startAfterParticipantPositionChangeId')
  })
}
