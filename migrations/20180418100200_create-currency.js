'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('currency', (t) => {
        t.string('currencyId', 3).primary().notNullable()
        t.string('name', 128).defaultTo(null).nullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('currency')
}
