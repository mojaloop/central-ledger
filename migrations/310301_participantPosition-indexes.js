'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('participantPosition', (t) => {
    t.index('participantCurrencyId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('participantPosition', (t) => {
    t.dropIndex('participantCurrencyId')
  })
}
