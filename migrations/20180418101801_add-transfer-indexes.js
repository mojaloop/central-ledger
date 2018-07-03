'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transfer', (t) => {
    t.index('currencyId')
    t.index('transferId')
    // t.index('transferStateChangeId')
    //t.index('settlementWindowId')
    //t.index('payerParticipantId')
    //t.index('payeeParticipantId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transfer', (t) => {
    t.dropIndex('currencyId')
    t.dropIndex('transferId')
    // t.dropIndex('transferStateChangeId')
    //t.dropIndex('settlementWindowId')
    //t.dropIndex('payerParticipantId')
    //t.dropIndex('payeeParticipantId')
  })
}
