'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('role', (t) => {
        t.increments('roleId').primary()
        t.string('name', 256).notNullable()
        t.string('description', 1000).nullable()
        t.text('permissions').notNullable()
        t.timestamp('createdDate').defaultTo(knex.fn.now()).notNullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('role')
}
