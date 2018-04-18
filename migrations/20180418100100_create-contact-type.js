'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('contactType', (t) => {
    t.increments('contactTypeId').primary()
    t.string('name', 256).notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('contactType')
}
