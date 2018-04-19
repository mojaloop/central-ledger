'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('participantLimit', (t) => {
        t.increments('participantLimitId').primary().notNullable()

        t.integer('participantId').unsigned().notNullable()
        t.foreign('participantId').references('participantId').inTable('participant')

        t.bigInteger('partyRoleId').unsigned().notNullable()
        t.foreign('partyRoleId').references('partyRoleId').inTable('partyRole')

        t.decimal('netDebitCap', 18, 2).defaultTo(0).notNullable()
        t.decimal('thresholdAlarmPercent', 5, 2).defaultTo(10).notNullable()
        t.dateTime('changedDate').defaultTo(knex.fn.now()).notNullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('participantLimit')
}
