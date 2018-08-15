'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('settlementTransferParticipant', (t) => {
    t.index('settlementId')
    t.index('participantCurrencyId')
    t.index('transferParticipantRoleTypeId', 'stp_transferparticipantroletypeid_index')
    t.index('ledgerEntryTypeId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('settlementTransferParticipant', (t) => {
    t.dropIndex('settlementId')
    t.dropIndex('participantCurrencyId')
    t.dropIndex('transferParticipantRoleTypeId', 'stp_transferparticipantroletypeid_index')
    t.dropIndex('ledgerEntryTypeId')
  })
}
