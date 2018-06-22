'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('participant', (t) => {
    t.increments('participantId').primary().notNullable()

    t.string('currencyId', 3).notNullable()
    t.foreign('currencyId').references('currencyId').inTable('currency')

    t.string('name', 256).notNullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
    t.boolean('isDisabled').defaultTo(false).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participant')
}
