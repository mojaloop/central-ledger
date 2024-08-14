'use strict'

exports.up = (knex) => {
  return knex.schema.hasTable('fxQuoteResponse').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('fxQuoteResponse', (t) => {
        t.bigIncrements('fxQuoteResponseId').primary().notNullable()

        // reference to the original fxQuote
        t.string('conversionRequestId', 36).notNullable()
        t.foreign('conversionRequestId').references('conversionRequestId').inTable('fxQuote')

        // ilpCondition sent in FXP response
        t.string('ilpCondition', 256).notNullable()

        // time keeping
        t.dateTime('expirationDate').defaultTo(null).nullable().comment('Optional expiration for the requested transaction')
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable().comment('System dateTime stamp pertaining to the inserted record')
      })
    }
  })
}

exports.down = (knex) => {
  return knex.schema.dropTableIfExists('fxQuoteResponse')
}
