'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('transferState', (t) => {
        t.unique('name')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('transferState', (t) => {
        t.dropUnique('name')
    })
}
