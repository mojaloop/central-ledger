'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('participantSettlement', (t) => {
        t.unique('participantId')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('participantSettlement', (t) => {
        t.dropUnique('participantId')
    })
}
