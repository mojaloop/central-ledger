'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('participantLimit', (t) => {
    t.bigIncrements('participantLimitId').unsigned().primary()
    t.big('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participant.participantId')
    t.big('partyRoleId').unsigned().notNullable()
    t.foreign('partyRoleId').references('partyRole.partyRoleId')
    t.decimal('netDebitCap', 10, 2).notNullable().default(0)
    t.integer('thresholdAlarmPercent').notNullable().default(10)
    t.timestamp('changedDate').notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('participantLimit')
}
