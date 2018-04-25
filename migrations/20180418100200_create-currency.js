'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('currency', (t) => {
        t.increments('currencyId').primary().notNullable().notNullable()
        t.string('code', 3).notNullable()
        t.string('name', 128).defaultTo(null).nullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('currency')
}
