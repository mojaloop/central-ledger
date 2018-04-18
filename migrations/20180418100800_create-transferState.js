'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('transferState', (t) => {
    t.increments('transferStateId').primary()
    t.string('name', 10).notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('transferState')
}
