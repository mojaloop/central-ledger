'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('settlementWindow', (t) => {
    t.bigIncrements('settlementWindowId').primary().notNullable()
    t.string('state', 50).defaultTo(null).nullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settlementWindow')
}
