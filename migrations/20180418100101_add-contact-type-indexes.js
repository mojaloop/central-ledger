'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('contactType', (t) => {
        t.unique('name')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('contactType', (t) => {
        t.dropUnique('name')
    })
}
