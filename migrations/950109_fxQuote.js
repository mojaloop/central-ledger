// Notes: these changes are required for the quoting-service and are not used by central-ledger
'use strict'

exports.up = (knex) => {
  return knex.schema.hasTable('fxQuote').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('fxQuote', (t) => {
        t.string('conversionRequestId', 36).primary().notNullable()

        // time keeping
        t.dateTime('expirationDate').defaultTo(null).nullable().comment('Optional expiration for the requested transaction')
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable().comment('System dateTime stamp pertaining to the inserted record')
      })
    }
  })
}

exports.down = (knex) => {
  return knex.schema.dropTableIfExists('fxQuote')
}
