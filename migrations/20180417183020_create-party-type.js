'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('partyType', (t) => {
        t.increments('partyTypeId').primary()
        t.string('name', 20).notNullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('partyType')
}
