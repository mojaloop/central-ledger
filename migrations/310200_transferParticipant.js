'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('transferParticipant', (t) => {
    t.bigIncrements('transferParticipantId').primary().notNullable()
    t.string('transferId', 36).notNullable()
    t.foreign('transferId').references('transferId').inTable('transfer')
    t.integer('participantCurrencyId').unsigned().notNullable()
    t.foreign('participantCurrencyId').references('participantCurrencyId').inTable('participantCurrency')
    t.integer('transferParticipantRoleTypeId').unsigned().notNullable()
    t.foreign('transferParticipantRoleTypeId').references('transferParticipantRoleTypeId').inTable('transferParticipantRoleType')
    t.integer('legerEntryTypeId').unsigned().notNullable()
    t.foreign('legerEntryTypeId').references('legerEntryTypeId').inTable('legerEntryType')
    t.decimal('amount', 18, 2).notNullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferParticipant')
}
