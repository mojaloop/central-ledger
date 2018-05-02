'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('extension', (t) => {
        t.index('transferId')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('extension', (t) => {
        t.dropIndex('transferId')
    })
}
