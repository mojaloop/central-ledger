'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('partyRole', (t) => {
        t.index('partyId')
        t.index('roleId')
        t.unique(['partyId', 'roleId'])
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('partyRole', (t) => {
        t.dropIndex('partyId')
        t.dropIndex('roleId')
        t.dropUnique(['partyId', 'roleId'])
    })
}
