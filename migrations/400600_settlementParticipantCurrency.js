'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('settlementParticipantCurrency').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('settlementParticipantCurrency', (t) => {
        t.bigIncrements('settlementParticipantCurrencyId').primary().notNullable()
        t.bigInteger('settlementId').unsigned().notNullable()
        t.foreign('settlementId').references('settlementId').inTable('settlement')
        t.integer('participantCurrencyId').unsigned().notNullable()
        t.foreign('participantCurrencyId').references('participantCurrencyId').inTable('participantCurrency')
        t.decimal('netAmount', 18, 2).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settlementParticipantCurrency')
}
