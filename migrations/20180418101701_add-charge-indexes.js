'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('charge', (t) => {
        t.index('payerParticipantId')
        t.index('payeeParticipantId')
        t.unique('name')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('charge', (t) => {
        t.dropIndex('payerParticipantId')
        t.dropIndex('payeeParticipantId')
        t.dropUnique('name')
    })
}
