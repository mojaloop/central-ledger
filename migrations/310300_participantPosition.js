'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('participantPosition').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('participantPosition', (t) => {
        t.bigIncrements('participantPositionId').primary().notNullable()
        t.integer('participantCurrencyId').unsigned().notNullable()
        t.foreign('participantCurrencyId').references('participantCurrencyId').inTable('participantCurrency')
        t.decimal('value', 18, 2).notNullable()
        t.decimal('reservedValue', 18, 2).notNullable()
        t.dateTime('changedDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantPosition')
}
