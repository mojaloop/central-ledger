'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('currency', (t) => {
    t.string('currencyId', 3).primary().notNullable()
    t.string('name', 128).defaultTo(null).nullable()
    t.boolean('isActive').defaultTo(true).notNullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('currency')
}
