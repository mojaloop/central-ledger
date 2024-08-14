// Notes: these changes are required for the quoting-service and are not used by central-ledger
'use strict'

exports.up = (knex) => {
  return knex.schema.hasTable('fxQuoteResponseConversionTermExtension').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('fxQuoteResponseConversionTermExtension', (t) => {
        t.bigIncrements('fxQuoteResponseConversionTermExtension').primary().notNullable()
        t.string('conversionId', 36).notNullable()
        t.foreign('conversionId').references('conversionId').inTable('fxQuoteResponseConversionTerms')
        t.string('key', 128).notNullable()
        t.text('value').notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable().comment('System dateTime stamp pertaining to the inserted record')
      })
    }
  })
}

exports.down = (knex) => {
  return knex.schema.dropTableIfExists('fxQuoteResponseConversionTermExtension')
}
