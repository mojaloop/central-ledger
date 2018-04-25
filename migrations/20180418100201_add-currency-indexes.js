'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('currency', (t) => {
        t.unique('code')
        t.unique('name')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('currency', (t) => {
        t.dropUnique('code')
        t.dropUnique('name')
    })
}
