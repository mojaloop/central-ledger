'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('participantCurrency', (t) => {
    t.increments('participantCurrencyId').primary().notNullable()
    t.integer('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participantId').inTable('participant')
    t.string('currencyId', 3).primary().notNullable()
    t.foreign('currencyId').references('currencyId').inTable('currency')
    t.boolean('isActive').defaultTo(true).notNullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
    t.string('createdBy', 128).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantCurrency')
}
