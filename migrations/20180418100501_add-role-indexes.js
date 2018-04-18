'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('role', (t) => {
        t.unique('name')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('role', (t) => {
        t.dropUnique('name')
    })
}
