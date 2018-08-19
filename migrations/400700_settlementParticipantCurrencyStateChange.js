'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('settlementParticipantCurrencyStateChange').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('settlementParticipantCurrencyStateChange', (t) => {
        t.bigIncrements('settlementParticipantCurrencyStateChangeId').primary().notNullable()
        t.bigInteger('settlementParticipantCurrencyId').unsigned().notNullable()
        t.foreign('settlementParticipantCurrencyId', 'spcsc_settlementparticipantcurrencyid_foreign').references('settlementParticipantCurrencyId').inTable('settlementParticipantCurrency')
        t.string('settlementStateId', 50).notNullable()
        t.foreign('settlementStateId', 'spcsc_settlementstateid_foreign').references('settlementStateId').inTable('settlementState')
        t.string('reason', 512).defaultTo(null).nullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settlementParticipantCurrencyStateChange')
}
