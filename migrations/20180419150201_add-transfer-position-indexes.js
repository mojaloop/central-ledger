'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('transferPosition', (t) => {
        t.index('transferId')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('transferPosition', (t) => {
        t.dropIndex('transferId')
    })
}
