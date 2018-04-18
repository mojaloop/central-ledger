'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('partyRole', (t) => {
        t.unique(['partyId', 'roleId'], 'partyrole_partyid_roleid_unique')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('partyRole', (t) => {
        t.dropUnique(['partyId', 'roleId'], 'partyrole_partyid_roleid_unique')
    })
}
