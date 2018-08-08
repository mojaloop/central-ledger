'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('settlementParticipantCurrencyStateChange', (t) => {
    t.index('settlementParticipantCurrencyId')
    t.index('settlementStateId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('settlementParticipantCurrencyStateChange', (t) => {
    t.dropIndex('settlementParticipantCurrencyId')
    t.dropIndex('settlementStateId')
  })
}
