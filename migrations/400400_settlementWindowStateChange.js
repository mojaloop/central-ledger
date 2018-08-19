'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('settlementWindowStateChange').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('settlementWindowStateChange', (t) => {
        t.bigIncrements('settlementWindowStateChangeId').primary().notNullable()
        t.bigInteger('settlementWindowId').unsigned().notNullable()
        t.foreign('settlementWindowId').references('settlementWindowId').inTable('settlementWindow')
        t.string('settlementWindowStateId', 50).notNullable()
        t.foreign('settlementWindowStateId').references('settlementWindowStateId').inTable('settlementWindowState')
        t.string('reason', 512).defaultTo(null).nullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settlementWindowStateChange')
}
