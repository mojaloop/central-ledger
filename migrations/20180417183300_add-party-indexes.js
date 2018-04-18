'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('party', (t) => {
        t.unique('key', 'party_key_unique')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('party', (t) => {
        t.dropUnique('key', 'party_key_unique')
    })
}
