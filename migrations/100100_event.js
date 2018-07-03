'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('event', (t) => {
    t.increments('eventId').primary().notNullable()
    t.string('name', 128).notNullable()
    t.string('description', 512)
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('event')
}
