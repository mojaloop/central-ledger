'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('settlementStateChange').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('settlementStateChange', (t) => {
        t.bigIncrements('settlementStateChangeId').primary().notNullable()
        t.bigInteger('settlementId').unsigned().notNullable()
        t.foreign('settlementId').references('settlementId').inTable('settlement')
        t.string('settlementStateId', 50).notNullable()
        t.foreign('settlementStateId').references('settlementStateId').inTable('settlementState')
        t.string('reason', 512).defaultTo(null).nullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settlementStateChange')
}
