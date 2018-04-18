'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('partyIdentifierType', (t) => {
        t.unique('name')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('partyIdentifierType', (t) => {
        t.dropUnique('name')
    })
}
