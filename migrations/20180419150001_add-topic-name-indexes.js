'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('eventName', (t) => {
        t.unique('value')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('eventName', (t) => {
        t.dropUnique('value')
    })
}
