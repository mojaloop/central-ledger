'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('accountsSettlement', (t) => {
    t.increments('accountSettlementId').primary()
    t.integer('accountId').notNullable()
    t.foreign('accountId').references('accounts.accountId')
    t.string('accountNumber', 16).notNullable()
    t.string('routingNumber', 16).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('accountsSettlement')
}
