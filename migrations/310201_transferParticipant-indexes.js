'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transferParticipant', (t) => {
    t.index('transferId')
    t.index('participantCurrencyId')
    t.index('transferParticipantRoleTypeId')
    t.index('ledgerEntryTypeId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transferParticipant', (t) => {
    t.dropIndex('transferId')
    t.dropIndex('participantCurrencyId')
    t.dropIndex('transferParticipantRoleTypeId')
    t.dropIndex('ledgerEntryTypeId')
  })
}
