'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('settlementSettlementWindow').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('settlementSettlementWindow', (t) => {
        t.bigIncrements('settlementSettlementWindowId').primary().notNullable()
        t.bigInteger('settlementId').unsigned().notNullable()
        t.foreign('settlementId').references('settlementId').inTable('settlement')
        t.bigInteger('settlementWindowId').unsigned().notNullable()
        t.foreign('settlementWindowId').references('settlementWindowId').inTable('settlementWindow')
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settlementSettlementWindow')
}
