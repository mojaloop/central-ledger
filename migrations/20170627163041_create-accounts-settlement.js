'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('accountsSettlement', (t) => {
    t.increments('accountSettlementId').primary()
    t.integer('accountId').unsigned().notNullable()
    t.foreign('accountId').references('accounts.accountId')
    t.text('accountNumber', 16).notNullable()
    t.text('routingNumber', 16).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('accountsSettlement')
}
