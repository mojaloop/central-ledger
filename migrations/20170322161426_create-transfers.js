'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('transfers', (t) => {
    t.uuid('transferUuid').primary()
    t.string('state', 10).notNullable()
    t.string('ledger', 1024).notNullable()
    t.integer('debitAccountId').nullable()
    t.foreign('debitAccountId').references('accounts.accountId')
    t.decimal('debitAmount', 10, 2).notNullable().defaultTo(0)
    t.string('debitMemo', 4000).nullable()
    t.integer('creditAccountId').nullable()
    t.foreign('creditAccountId').references('accounts.accountId')
    t.decimal('creditAmount', 10, 2).notNullable().defaultTo(0)
    t.string('creditMemo', 4000).nullable()
    t.smallint('creditRejected').notNullable().defaultTo(0)
    t.string('creditRejectionMessage', 4000).nullable()
    t.string('executionCondition', 4000).nullable()
    t.string('cancellationCondition', 4000).nullable()
    t.string('fulfillment', 65535).nullable()
    t.string('rejectionReason', 512).nullable()
    t.timestamp('expiresAt').nullable()
    t.string('additionalInfo', 4000).nullable()
    t.timestamp('preparedDate').nullable()
    t.timestamp('executedDate').nullable()
    t.timestamp('rejectedDate').nullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('transfers')
}
