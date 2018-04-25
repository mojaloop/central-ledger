'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('role', (t) => {
        t.increments('roleId').primary().notNullable()
        t.string('name', 256).notNullable()
        t.string('description', 1024).defaultTo(null).nullable()
        t.text('permissions').notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('role')
}
