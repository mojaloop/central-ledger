'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('transfers', (t) => {
    t.uuid('transferUuid').primary()
    t.text('state', 10).notNullable()
    t.text('ledger', 1024).notNullable()
    t.integer('debitAccountId').unsigned().nullable()
    t.foreign('debitAccountId').references('accounts.accountId')
    t.decimal('debitAmount', 10, 2).notNullable().defaultTo(0)
    t.text('debitMemo', 4000).nullable()
    t.integer('creditAccountId').unsigned().nullable()
    t.foreign('creditAccountId').references('accounts.accountId')
    t.decimal('creditAmount', 10, 2).notNullable().defaultTo(0)
    t.text('creditMemo', 4000).nullable()
    t.smallint('creditRejected').notNullable().defaultTo(0)
    t.text('creditRejectionMessage', 4000).nullable()
    t.text('executionCondition', 4000).nullable()
    t.text('cancellationCondition', 4000).nullable()
    t.text('fulfillment', 65535).nullable()
    t.text('rejectionReason', 512).nullable()
    t.timestamp('expiresAt').nullable()
    t.text('additionalInfo', 4000).nullable()
    t.timestamp('preparedDate').nullable()
    t.timestamp('executedDate').nullable()
    t.timestamp('rejectedDate').nullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('transfers')
}
