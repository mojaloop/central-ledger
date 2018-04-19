'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('transferState', (t) => {
        t.increments('transferStateId').primary().notNullable()
        t.string('name', 50).notNullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('transferState')
}
