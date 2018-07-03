'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('contactType', (t) => {
    t.increments('contactTypeId').primary().notNullable()
    t.string('name', 20).notNullable()
    t.string('description', 512)
    t.boolean('isActive').defaultTo(true).notNullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('contactType')
}
