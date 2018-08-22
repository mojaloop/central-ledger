'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('transfer').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('transfer', (t) => {
        t.string('transferId', 36).primary().notNullable()
        t.foreign('transferId').references('transferId').inTable('transferDuplicateCheck')
        t.decimal('amount', 18, 2).notNullable()
        t.string('currencyId', 3).notNullable()
        t.foreign('currencyId').references('currencyId').inTable('currency')
        t.string('ilpCondition', 256).notNullable()
        t.dateTime('expirationDate').notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transfer')
}
