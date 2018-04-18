'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('currency', (t) => {
    t.increments('currencyId').primary()
    t.string('code', 3).notNullable()
    t.string('name', 50).notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('currency')
}
