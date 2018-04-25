'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('transfer', (t) => {
        t.string('transferId', 36).primary().notNullable()

        t.bigInteger('transferBatchId').unsigned().notNullable()
        t.foreign('transferBatchId').references('transferBatchId').inTable('transferBatch')

        t.integer('payerParticipantId').unsigned().defaultTo(null).nullable()
        t.foreign('payerParticipantId').references('participantId').inTable('participant')

        t.decimal('payerAmount', 18, 2).defaultTo(0).notNullable()
        t.string('payerNote', 4000).defaultTo(null).nullable()

        t.integer('payeeParticipantId').unsigned().defaultTo(null).nullable()
        t.foreign('payeeParticipantId').references('participantId').inTable('participant')

        t.decimal('payeeAmount', 18, 2).defaultTo(0).notNullable()
        t.string('payeeNote', 4000).defaultTo(null).nullable()
        t.dateTime('preparedDate').defaultTo(null).nullable()
        t.dateTime('expirationDate').defaultTo(null).nullable()
        t.string('ledger', 1024).notNullable()
        t.boolean('payeeRejected').defaultTo(false).notNullable()
        t.string('payeeRejectionMessage', 4000).defaultTo(null).nullable()
        t.string('cancellationCondition', 4000).defaultTo(null).nullable()
        t.string('rejectionReason', 512).defaultTo(null).nullable()
        t.string('additionalInfo', 4000).defaultTo(null).nullable()
        t.dateTime('validatedDate').defaultTo(null).nullable()
        t.dateTime('rejectedDate').defaultTo(null).nullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('transfer')
}
