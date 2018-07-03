'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('participantCurrency', (t) => {
    t.index('participantId')
    t.index('currencyId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('participantCurrency', (t) => {
    t.dropIndex('participantId')
    t.dropIndex('currencyId')
  })
}
