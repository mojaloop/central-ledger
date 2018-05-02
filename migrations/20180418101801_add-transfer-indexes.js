'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('transfer', (t) => {
        t.index('transferSettlementBatchId')
        t.index('payerParticipantId')
        t.index('payeeParticipantId')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('transfer', (t) => {
        t.dropIndex('transferSettlementBatchId')
        t.dropIndex('payerParticipantId')
        t.dropIndex('payeeParticipantId')
    })
}
