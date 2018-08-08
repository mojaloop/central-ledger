'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('settlementTransferParticipant').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('settlementTransferParticipant', (t) => {
        t.bigIncrements('settlementTransferParticipantId').primary().notNullable()
        t.bigInteger('settlementId').unsigned().notNullable()
        t.foreign('settlementId').references('settlementId').inTable('settlement')
        t.integer('participantCurrencyId').unsigned().notNullable()
        t.foreign('participantCurrencyId').references('participantCurrencyId').inTable('participantCurrency')
        t.integer('transferParticipantRoleTypeId').unsigned().notNullable()
        t.foreign('transferParticipantRoleTypeId', 'stp_transferparticipantroletypeid_foreign').references('transferParticipantRoleTypeId').inTable('transferParticipantRoleType')
        t.integer('ledgerEntryTypeId').unsigned().notNullable()
        t.foreign('ledgerEntryTypeId').references('ledgerEntryTypeId').inTable('ledgerEntryType')
        t.decimal('amount', 18, 2).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settlementTransferParticipant')
}
