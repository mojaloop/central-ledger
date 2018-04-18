'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('participantContact', (t) => {
    t.bigIncrements('participantContactId').unsigned().primary()
    t.big('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participant.participantId')
    t.integer('contactTypeId').unsigned().notNullable()
    t.foreign('contactTypeId').references('contactType.contactTypeId')
    t.string('value', 256).notNullable()
    t.integer('priorityPreference').notNullable().defaultTo(9)
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('participantContact')
}
