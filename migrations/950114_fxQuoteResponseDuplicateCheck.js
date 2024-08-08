// Notes: these changes are required for the quoting-service and are not used by central-ledger
'use strict'

exports.up = (knex) => {
  return knex.schema.hasTable('fxQuoteResponseDuplicateCheck').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('fxQuoteResponseDuplicateCheck', (t) => {
        t.bigIncrements('fxQuoteResponseId').primary().unsigned().comment('The response to the intial quote')
        t.foreign('fxQuoteResponseId').references('fxQuoteResponseId').inTable('fxQuoteResponse')
        t.string('conversionRequestId', 36).notNullable()
        t.foreign('conversionRequestId').references('conversionRequestId').inTable('fxQuote')
        t.string('hash', 255).defaultTo(null).nullable().comment('hash value received for the quote response')
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable().comment('System dateTime stamp pertaining to the inserted record')
      })
    }
  })
}

exports.down = (knex) => {
  return knex.schema.dropTableIfExists('fxQuoteResponseDuplicateCheck')
}
