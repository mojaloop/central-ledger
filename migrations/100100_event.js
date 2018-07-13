'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('event').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('event', (t) => {
        t.increments('eventId').primary().notNullable()
        t.string('name', 128).notNullable()
        t.string('description', 512).defaultTo(null).nullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('event')
}
