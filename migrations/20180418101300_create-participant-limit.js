'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('participantLimit', (t) => {
    t.increments('participantLimitId').primary()

    t.integer('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participantId').inTable('participant')

    t.integer('partyRoleId').unsigned().notNullable()
    t.foreign('partyRoleId').references('partyRoleId').inTable('partyRole')

    t.decimal('netDebitCap', 10, 2).default(0).notNullable()
    t.integer('thresholdAlarmPercent').default(10).notNullable()
    t.dateTime('changedDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('participantLimit')
}
