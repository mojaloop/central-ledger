'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('ilp', (t) => {
        t.index('transferId')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('ilp', (t) => {
        t.dropIndex('transferId')
    })
}
