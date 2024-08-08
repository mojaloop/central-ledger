'use strict'

exports.up = (knex) => {
  return knex.schema.hasTable('fxQuoteResponse').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('fxQuoteResponse', (t) => {
        t.bigIncrements('fxQuoteResponseId').primary().notNullable()
        t.string('conversionRequestId', 36).notNullable()
        t.foreign('conversionRequestId').references('conversionRequestId').inTable('fxQuote')
        t.string('conversionId', 36)
        t.string('ilpCondition', 256).notNullable()
        t.integer('amountTypeId').unsigned().notNullable().comment('This is part of the transaction type that contains valid elements for - Amount Type')
        t.foreign('amountTypeId').references('amountTypeId').inTable('amountType')
        t.string('initiatingFsp', 255)
        t.string('counterPartyFsp', 255)
        t.decimal('sourceAmount', 18, 4).notNullable()
        t.string('sourceCurrency', 3).notNullable()
        t.foreign('sourceCurrency').references('currencyId').inTable('currency')
        t.decimal('targetAmount', 18, 4).notNullable()
        t.string('targetCurrency', 3).notNullable()
        t.foreign('targetCurrency').references('currencyId').inTable('currency')
        t.dateTime('expirationDate').defaultTo(null).nullable().comment('Optional expiration for the requested transaction')
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable().comment('System dateTime stamp pertaining to the inserted record')
      })
    }
  })
}

exports.down = (knex) => {
  return knex.schema.dropTableIfExists('fxQuoteResponse')
}
