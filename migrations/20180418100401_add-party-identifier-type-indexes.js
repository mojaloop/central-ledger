'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('partyIdentifierType', (t) => {
        t.unique('name', 'partyidentifiertype_name_unique')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('partyIdentifierType', (t) => {
        t.dropUnique('name', 'partyidentifiertype_name_unique')
    })
}
