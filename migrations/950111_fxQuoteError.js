// Notes: these changes are required for the quoting-service and are not used by central-ledger
'use strict'

exports.up = (knex) => {
  return knex.schema.hasTable('fxQuoteError').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('fxQuoteError', (t) => {
        t.bigIncrements('fxQuoteErrorId').primary().notNullable()
        t.string('conversionRequestId', 36).notNullable()
        t.foreign('conversionRequestId').references('conversionRequestId').inTable('fxQuote')
        t.bigInteger('fxQuoteResponseId').unsigned().defaultTo(null).nullable().comment('The response to the initial fxQuote')
        t.foreign('fxQuoteResponseId').references('fxQuoteResponseId').inTable('fxQuoteResponse')
        t.integer('errorCode').unsigned().notNullable()
        t.string('errorDescription', 128).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = (knex) => {
  return knex.schema.dropTableIfExists('quoteError')
}
