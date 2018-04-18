'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('partyType', (t) => {
        t.unique('name', 'partytype_name_unique')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('partyType', (t) => {
        t.dropUnique('name', 'partytype_name_unique')
    })
}
