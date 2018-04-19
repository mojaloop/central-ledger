'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('partyType', (t) => {
        t.increments('partyTypeId').primary().notNullable()
        t.string('name', 128).notNullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('partyType')
}
