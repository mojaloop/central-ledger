'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('participant', (t) => {
    t.increments('participantId').primary().notNullable()
    t.string('name', 256).notNullable()
    t.string('description', 512).defaultTo(null).nullable()
    t.boolean('isActive').defaultTo(true).notNullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
    t.string('createdBy', 128).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participant')
}
