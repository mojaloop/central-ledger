'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('participantSettlement', (t) => {
        t.unique('participantId', 'participantsettlement_participantid_unique')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('participantSettlement', (t) => {
        t.dropUnique('participantId', 'participantsettlement_participantid_unique')
    })
}
