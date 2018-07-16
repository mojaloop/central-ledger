'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('settlement').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('settlement', (t) => {
        t.bigIncrements('settlementId').primary().notNullable()
        t.bigInteger('settlementWindowId').unsigned().notNullable()
        t.foreign('settlementWindowId').references('settlementWindowId').inTable('settlementWindow')
        t.string('settlementType', 16).notNullable()
        t.dateTime('settledDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settlement')
}
