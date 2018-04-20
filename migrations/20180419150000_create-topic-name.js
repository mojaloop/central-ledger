'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('eventName', (t) => {
        t.bigIncrements('eventNameId').primary().notNullable()

        t.string('value', 128).notNullable()
        t.string('description', 1024).defaultTo(null).nullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('eventName')
}
