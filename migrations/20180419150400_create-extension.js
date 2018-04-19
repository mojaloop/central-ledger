'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('extension', (t) => {
        t.bigIncrements('extensionId').primary().notNullable()

        t.string('transferId', 36).notNullable()
        t.foreign('transferId').references('transferId').inTable('transfer')

        t.string('key', 128).notNullable()
        t.text('value').notNullable()
        t.dateTime('changedDate').defaultTo(knex.fn.now()).notNullable()
        t.string('changedBy', 128).notNullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('extension')
}
