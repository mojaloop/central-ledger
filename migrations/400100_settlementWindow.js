'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('settlementWindow').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('settlementWindow', (t) => {
        t.bigIncrements('settlementWindowId').primary().notNullable()
        t.string('state', 50).defaultTo(null).nullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settlementWindow')
}
