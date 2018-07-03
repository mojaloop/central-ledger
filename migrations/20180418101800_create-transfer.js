'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('transfer', (t) => {
    t.string('transferId', 36).primary().notNullable()

    t.integer('payeeParticipantId').unsigned().notNullable().comment('payeeFsp')
    t.foreign('payeeParticipantId').references('participantId').inTable('participant')

    t.integer('payerParticipantId').unsigned().notNullable().comment('payerFsp')
    t.foreign('payerParticipantId').references('participantId').inTable('participant')

    // t.decimal('payerAmount', 18, 2).notNullable()
      // t.string('payerNote', 4000).defaultTo(null).nullable()
    // t.text('payerNote', 'text').defaultTo(null).nullable()

    // t.decimal('payeeAmount', 18, 2).notNullable()
    // t.string('payeeNote', 4000).defaultTo(null).nullable()
    // t.text('payeeNote', 'text').defaultTo(null).nullable()

    t.decimal('amount', 18, 2).notNullable()
    t.string('currencyId', 3).notNullable().comment('currency')
    t.foreign('currencyId').references('currencyId').inTable('currency')

    t.dateTime('expirationDate').defaultTo(null).nullable().comment('expiration ilp condition')

    // t.bigInteger('transferStateChangeId').unsigned().defaultTo(0).notNullable().comment('transferState')
    // t.bigInteger('transferStateChangeId').unsigned().defaultTo(0).nullable().comment('transferState')
    // t.string('transferStateId', 50).primary().notNullable()
    // t.foreign('transferStateChangeId').references('transferStateChangeId').inTable('transferStateChange')

    // t.bigInteger('settlementWindowId').unsigned().notNullable()
    t.bigInteger('settlementWindowId').unsigned().defaultTo(0).nullable()

    // @TODO to be added at a later stage was causing issues on initial insert
    // t.foreign('settlementWindowId').references('settlementWindowId').inTable('settlementWindow')

    // t.dateTime('preparedDate').defaultTo(null).nullable()
    // t.string('ledger', 1024).notNullable()
    // t.boolean('payeeRejected').defaultTo(false).notNullable()
    // t.string('payeeRejectionMessage', 4000).defaultTo(null).nullable()
    // t.string('cancellationCondition', 4000).defaultTo(null).nullable()
    // t.text('payeeRejectionMessage', 'text').defaultTo(null).nullable()
    // t.text('cancellationCondition', 'text').defaultTo(null).nullable()
    // t.string('rejectionReason', 512).defaultTo(null).nullable()
    // t.text('rejectionReason', 'text').defaultTo(null).nullable()
    // t.string('additionalInfo', 4000).defaultTo(null).nullable()
    // t.text('additionalInfo', 'text').defaultTo(null).nullable()
    // t.dateTime('validatedDate').defaultTo(null).nullable()
    // t.dateTime('rejectedDate').defaultTo(null).nullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transfer')
}
