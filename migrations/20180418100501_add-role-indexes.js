'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('role', (t) => {
        t.unique('name', 'role_name_unique')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('role', (t) => {
        t.dropUnique('name', 'role_name_unique')
    })
}
