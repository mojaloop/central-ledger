'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('participantPosition', (t) => {
    t.bigIncrements('participantPositionId').primary().notNullable()

    t.integer('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participantId').inTable('participant')

    t.string('type', 16).notNullable().comment('type of limit e.g. netDebitCap')
    t.foreign('type').references('type').inTable('participantLimit')
    t.decimal('value', 18, 2).notNullable().comment('value of limit')

    t.dateTime('changedDate').defaultTo(knex.fn.now()).notNullable()
    t.string('changedBy', 128).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantPosition')
}
