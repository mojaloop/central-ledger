'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('partyType', (t) => {
        t.unique('name')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('partyType', (t) => {
        t.dropUnique('name')
    })
}
