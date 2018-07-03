'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('settledFee', (t) => {
    t.bigIncrements('settledFeeId').primary().notNullable()
    t.bigInteger('feeId').unsigned().nullable()
    t.bigInteger('settlementId').unsigned().notNullable()
    t.foreign('settlementId').references('settlementId').inTable('settlement')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settledFee')
}
