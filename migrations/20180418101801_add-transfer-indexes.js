'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('transfer', (t) => {
        t.index('transferBatchId')
        t.index('payerParticipantId')
        t.index('payeeParticipantId')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('transfer', (t) => {
        t.dropIndex('transferBatchId')
        t.dropIndex('payerParticipantId')
        t.dropIndex('payeeParticipantId')
    })
}
