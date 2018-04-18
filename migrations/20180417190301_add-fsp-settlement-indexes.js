'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('fspSettlement', (t) => {
        t.unique('fspId', 'fspsettlement_fspid_unique')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('fspSettlement', (t) => {
        t.dropUnique('fspId', 'fspsettlement_fspid_unique')
    })
}
