'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('fees', (t) => {
    t.increments('feeId').primary()
    t.uuid('transferId').notNullable()
    t.decimal('amount', 10, 2).notNullable()
    t.integer('payerAccountId').notNullable()
    t.integer('payeeAccountId').notNullable()
    t.integer('chargeId').notNullable()
    t.timestamp('createdDate').notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('fees')
}
