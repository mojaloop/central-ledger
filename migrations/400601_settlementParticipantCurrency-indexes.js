'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('settlementParticipantCurrency', (t) => {
    t.index('settlementId')
    t.index('participantCurrencyId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('settlementParticipantCurrency', (t) => {
    t.dropIndex('settlementId')
    t.dropIndex('participantCurrencyId')
  })
}
