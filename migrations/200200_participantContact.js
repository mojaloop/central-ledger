'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('participantContact').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('participantContact', (t) => {
        t.increments('participantContactId').primary().notNullable()
        t.integer('participantId').unsigned().notNullable()
        t.foreign('participantId').references('participantId').inTable('participant')
        t.integer('contactTypeId').unsigned().notNullable()
        t.foreign('contactTypeId').references('contactTypeId').inTable('contactType')
        t.string('value', 256).notNullable()
        t.integer('priorityPreference').defaultTo(9).notNullable()
        t.boolean('isActive').defaultTo(true).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
        t.string('createdBy', 128).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantContact')
}
