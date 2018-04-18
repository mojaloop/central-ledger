'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('transfer', (t) => {
    t.uuid('transferId').notNullable().primary()
    t.integer('transferBatchId').unsigned().notNullable() //FI should create indexes also
    t.foreign('transferBatchId').references('transferBatchId').inTable('transferBatch')
    t.integer('payerParticipantId').unsigned().nullable() //FI should create indexes also
    t.foreign('payerParticipantId').references('participantId').inTable('participant')
    t.decimal('payerAmount', 10, 2).notNullable().defaultTo(0)
    t.text('payerNote', 4000).nullable()
    t.integer('payeeParticipantId').unsigned().nullable() //FI should create indexes also
    t.foreign('payeeParticipantId ').references('participantId').inTable('participant')
    t.decimal('payeeAmount', 10, 2).notNullable().defaultTo(0)
    t.text('payeeNote', 4000).nullable()
    t.timestamp('preparedDate').nullable()
    t.timestamp('expirationDate').nullable()
    t.text('ledger', 1024).notNullable()
    t.smallint('payeeRejected').notNullable().defaultTo(0)
    t.text('payeeRejectionMessage', 4000).nullable()
    t.text('cancellationCondition', 4000).nullable()
    t.text('rejectionReason', 512).nullable()
    t.text('additionalInfo', 4000).nullable()
    t.timestamp('validatedDate').nullable()
    t.timestamp('rejectedDate').nullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('transfer')
}
