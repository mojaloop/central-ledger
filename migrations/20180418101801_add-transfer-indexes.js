'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transfer', (t) => {
    t.index('transferId')
    // t.index('transferStateChangeId')
    t.index('transferSettlementBatchId')
    t.index('payerParticipantId')
    t.index('payeeParticipantId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transfer', (t) => {
    t.dropIndex('transferId')
    // t.dropIndex('transferStateChangeId')
    t.dropIndex('transferSettlementBatchId')
    t.dropIndex('payerParticipantId')
    t.dropIndex('payeeParticipantId')
  })
}
