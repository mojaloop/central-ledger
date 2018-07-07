'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('participantLimit', (t) => {
    t.increments('participantLimitId').primary().notNullable()

    t.integer('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participantId').inTable('participant')

    t.string('type', 16).notNullable().comment('type of limit e.g. netDebitCap')
    t.decimal('value', 18, 2).defaultTo(0).notNullable().comment('value of limit')

    t.dateTime('changedDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantLimit')
}
