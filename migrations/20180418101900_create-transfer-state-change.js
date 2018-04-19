'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('transferStateChange', (t) => {
        t.string('transferId', 36).primary().notNullable()
        t.foreign('transferId').references('transferId').inTable('transfer')

        t.integer('transferStateId').unsigned().notNullable()
        t.foreign('transferStateId').references('transferStateId').inTable('transferState')

        t.dateTime('changedDate').defaultTo(knex.fn.now()).notNullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('transferStateChange')
}
