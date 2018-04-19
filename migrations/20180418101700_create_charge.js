'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('charge', (t) => {
        t.increments('chargeId').primary().notNullable()
        t.string('chargeType', 256).notNullable()
        t.string('name', 256).notNullable()

        t.integer('payerParticipantId').unsigned().notNullable()
        t.foreign('payerParticipantId').references('participantId').inTable('participant')

        t.integer('payeeParticipantId').unsigned().notNullable()
        t.foreign('payeeParticipantId').references('participantId').inTable('participant')

        t.decimal('rate', 18, 2).defaultTo(0).notNullable()
        t.string('rateType', 256).notNullable()
        t.decimal('minimum', 18, 2).defaultTo(null).nullable()
        t.decimal('maximum', 18, 2).defaultTo(null).nullable()
        t.string('code', 256).defaultTo(null).nullable()
        t.boolean('isActive').defaultTo(false).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('charge')
}
