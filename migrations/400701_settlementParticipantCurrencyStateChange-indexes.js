'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('settlementParticipantCurrencyStateChange', (t) => {
    t.index('settlementParticipantCurrencyId', 'spcsc_settlementparticipantcurrencyid_index')
    t.index('settlementStateId', 'spcsc_settlementstateid_index')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('settlementParticipantCurrencyStateChange', (t) => {
    t.dropIndex('settlementParticipantCurrencyId', 'spcsc_settlementparticipantcurrencyid_index')
    t.dropIndex('settlementStateId', 'spcsc_settlementstateid_index')
  })
}
