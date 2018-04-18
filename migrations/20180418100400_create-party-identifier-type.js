'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('partyIdentifierType', (t) => {
        t.increments('partyIdentifierTypeId').primary()
        t.string('name', 50).notNullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('partyIdentifierType')
}
