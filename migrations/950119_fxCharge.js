'use strict'

exports.up = (knex) => {
  return knex.schema.hasTable('fxCharge').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('fxCharge', (t) => {
        t.bigIncrements('fxChargeId').primary().notNullable()
        t.string('chargeType', 32).notNullable().comment('A description of the charge which is being levied.')

        // fxCharge should only be sent back in the response to an fxQuote
        // so reference the terms in fxQuoteResponse `conversionTerms`
        t.string('conversionId', 36).notNullable()
        t.foreign('conversionId').references('conversionId').inTable('fxQuoteResponseConversionTerms')

        t.decimal('sourceAmount', 18, 4).nullable().comment('The amount of the charge which is being levied, expressed in the source currency.')
        t.string('sourceCurrency', 3).nullable().comment('The currency in which the source amount charge is being levied.')

        t.decimal('targetAmount', 18, 4).nullable().comment('The amount of the charge which is being levied, expressed in the target currency.')
        t.string('targetCurrency', 3).nullable().comment('The currency in which the target amount charge is being levied.')
      })
    }
  })
}

exports.down = (knex) => {
  return knex.schema.dropTableIfExists('fxCharge')
}
