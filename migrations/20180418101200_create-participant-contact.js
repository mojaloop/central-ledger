'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('participantContact', (t) => {
    t.increments('participantContactId').primary().notNullable()

    t.integer('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participantId').inTable('participant')

    t.integer('contactTypeId').unsigned().notNullable()
    t.foreign('contactTypeId').references('contactTypeId').inTable('contactType')

    t.string('value', 256).notNullable()
    t.integer('priorityPreference').defaultTo(9).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantContact')
}
