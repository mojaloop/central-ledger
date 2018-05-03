'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('transferState', (t) => {
    // t.increments('transferStateId').primary().notNullable()
    t.string('transferStateId', 50).primary().notNullable()
    // t.string('name', 50).primary().notNullable()
    t.string('enumeration', 50).notNullable().comment('transferState associated to the Mojaloop API')
    t.string('description', 256).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferState')
}
