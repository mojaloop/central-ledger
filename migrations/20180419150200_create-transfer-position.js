'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('transferPosition', (t) => {
        t.bigIncrements('transferPositionId').primary().notNullable()

        t.string('transferId', 36).notNullable()
        t.foreign('transferId').references('transferId').inTable('transfer')

        t.decimal('value', 18, 2).notNullable()
        t.dateTime('changedDate').defaultTo(knex.fn.now()).notNullable()
        t.string('changedBy', 128).notNullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('transferPosition')
}
