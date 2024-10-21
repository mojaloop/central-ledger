// Notes: these changes are required for the quoting-service and are not used by central-ledger
'use strict'

exports.up = (knex) => {
  return knex.schema.hasTable('fxQuoteDuplicateCheck').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('fxQuoteDuplicateCheck', (t) => {
        t.string('conversionRequestId', 36).primary().notNullable()
        t.string('hash', 1024).defaultTo(null).nullable().comment('hash value received for the quote request')
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable().comment('System dateTime stamp pertaining to the inserted record')
      })
    }
  })
}

exports.down = (knex) => {
  return knex.schema.dropTableIfExists('fxQuoteDuplicateCheck')
}
