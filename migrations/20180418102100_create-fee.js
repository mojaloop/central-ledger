'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('fee', (t) => {
    t.bigIncrements('feeId').primary().notNullable()

    t.string('transferId', 36).notNullable()
    t.foreign('transferId').references('transferId').inTable('transfer')

    t.decimal('amount', 18, 2).notNullable()

    t.integer('payerParticipantId').unsigned().notNullable()
    t.foreign('payerParticipantId').references('participantId').inTable('participant')

    t.integer('payeeParticipantId').unsigned().notNullable()
    t.foreign('payeeParticipantId').references('participantId').inTable('participant')

    t.integer('chargeId').unsigned().notNullable()
    t.foreign('chargeId').references('chargeId').inTable('charge')

    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('fee')
}
