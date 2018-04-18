'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('transfer', (t) => {
    t.index(['transferBatchId', 'payerParticipantId', 'payeeParticipantId'])
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('transfer', (t) => {
    t.dropIndex(['transferBatchId', 'payerParticipantId', 'payeeParticipantId'])
  })
}
