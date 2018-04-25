'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('settlement', (t) => {
        t.index('transferBatchId')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('settlement', (t) => {
        t.dropIndex('transferBatchId')
    })
}
