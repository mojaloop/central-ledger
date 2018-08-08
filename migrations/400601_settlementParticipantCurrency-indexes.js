'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('settlementTransferParticipant', (t) => {
    t.index('settlementId')
    t.index('participantCurrencyId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('settlementTransferParticipant', (t) => {
    t.dropIndex('settlementId')
    t.dropIndex('participantCurrencyId')
  })
}
