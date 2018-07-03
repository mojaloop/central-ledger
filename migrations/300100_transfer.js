'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('transfer', (t) => {
    t.string('transferId', 36).primary().notNullable()
    t.decimal('amount', 18, 2).notNullable()
    t.string('currencyId', 3).notNullable().comment('currency')
    t.foreign('currencyId').references('currencyId').inTable('currency')
    t.string('iplcondition', 256).notNullable()
    t.dateTime('expirationDate').defaultTo(null).nullable().comment('expiration ilp condition')
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transfer')
}
