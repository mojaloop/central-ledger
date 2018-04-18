'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('transfer', (t) => {
    t.string('transferId', 36).primary()

    t.integer('transferBatchId').unsigned().notNullable()
    t.foreign('transferBatchId').references('transferBatchId').inTable('transferBatch')

    t.integer('payerParticipantId').unsigned().nullable()
    t.foreign('payerParticipantId').references('participantId').inTable('participant')

    t.decimal('payerAmount', 10, 2).defaultTo(0).notNullable()
    t.string('payerNote', 4000).nullable()

    t.integer('payeeParticipantId').unsigned().nullable()
    t.foreign('payeeParticipantId').references('participantId').inTable('participant')

    t.decimal('payeeAmount', 10, 2).defaultTo(0).notNullable()
    t.string('payeeNote', 4000).nullable()
    t.dateTime('preparedDate').nullable()
    t.dateTime('expirationDate').nullable()
    t.string('ledger', 1024).notNullable()
    t.integer('payeeRejected').defaultTo(0).notNullable()
    t.string('payeeRejectionMessage', 4000).nullable()
    t.string('cancellationCondition', 4000).nullable()
    t.string('rejectionReason', 512).nullable()
    t.string('additionalInfo', 4000).nullable()
    t.dateTime('validatedDate').nullable()
    t.dateTime('rejectedDate').nullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('transfer')
}
