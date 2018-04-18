'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('fee', (t) => {
    t.increments('feeId').primary()
    t.uuid('transferId').notNullable()
    t.decimal('amount', 10, 2).notNullable()
    t.integer('payerParticipantId').notNullable()
    t.integer('payeeParticipantId').notNullable()
    t.integer('chargeId').notNullable()
    t.timestamp('createdDate').notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('fee')
}
