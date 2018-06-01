'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('fee', (t) => {
    t.index('transferId')
    t.index('payerParticipantId')
    t.index('payeeParticipantId')
    t.index('chargeId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('fee', (t) => {
    t.dropIndex('transferId')
    t.dropIndex('payerParticipantId')
    t.dropIndex('payeeParticipantId')
    t.dropIndex('chargeId')
  })
}
