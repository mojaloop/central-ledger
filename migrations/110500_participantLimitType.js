'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('participantLimitType', (t) => {
    t.increments('participantLimitTypeId').primary().notNullable()
    t.string('name', 50).notNullable()
    t.string('description', 512)
    t.boolean('isActive').defaultTo(true).notNullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantLimitType')
}
