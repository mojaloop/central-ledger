'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('settlement', (t) => {
    t.bigIncrements('settlementId').primary().notNullable()

    t.bigInteger('settlementWindowId').unsigned().notNullable()
    t.foreign('settlementWindowId').references('settlementWindowId').inTable('settlementWindow')

    t.string('settlementType', 16).notNullable()
    t.dateTime('settledDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settlement')
}
