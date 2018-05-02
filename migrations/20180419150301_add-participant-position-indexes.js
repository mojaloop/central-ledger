'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('participantPosition', (t) => {
        t.index('participantId')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('participantPosition', (t) => {
        t.dropIndex('participantId')
    })
}
