'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('participantPosition', (t) => {
    t.bigIncrements('participantPositionId').primary().notNullable()

    t.integer('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participantId').inTable('participant')

    t.decimal('value', 18, 2).notNullable()
    t.dateTime('changedDate').defaultTo(knex.fn.now()).notNullable()
    t.string('changedBy', 128).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantPosition')
}
