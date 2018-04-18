'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('contactType', (t) => {
    t.integer('contactTypeId').unsigned().primary()
    t.string('name', 256).notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('contactType')
}
