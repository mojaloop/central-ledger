'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('party', (t) => {
        t.index('partyTypeId')
        t.index('partyIdentifierTypeId')
        t.unique('key')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('party', (t) => {
        t.dropIndex('partyTypeId')
        t.dropIndex('partyIdentifierTypeId')
        t.dropUnique('key')
    })
}
