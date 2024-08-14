// Notes: these changes are required for the quoting-service and are not used by central-ledger
'use strict'

exports.up = (knex) => {
  return knex.schema.hasTable('fxQuoteConversionTermExtension').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('fxQuoteConversionTermExtension', (t) => {
        t.bigIncrements('fxQuoteConversionTermExtension').primary().notNullable()
        t.string('conversionId', 36).notNullable()
        t.foreign('conversionId').references('conversionId').inTable('fxQuoteConversionTerms')
        t.string('key', 128).notNullable()
        t.text('value').notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable().comment('System dateTime stamp pertaining to the inserted record')
      })
    }
  })
}

exports.down = (knex) => {
  return knex.schema.dropTableIfExists('fxQuoteConversionTermExtension')
}
