'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('settledFee').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('settledFee', (t) => {
        t.bigIncrements('settledFeeId').primary().notNullable()
        t.bigInteger('feeId').unsigned().nullable()
        t.bigInteger('settlementId').unsigned().notNullable()
        t.foreign('settlementId').references('settlementId').inTable('settlement')
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settledFee')
}
