'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('transferFulfilment', (t) => {
    t.string('transferFulfilmentId', 36).primary().notNullable()
    t.string('transferId', 36).notNullable()
    t.foreign('transferId').references('transferId').inTable('transfer')
    t.string('ilpFulfilment', 256).notNullable()
    t.dateTime('completedDate').notNullable()
    t.boolean('isValid').nullable()
    t.bigInteger('settlementWindowId').nullable()
    t.foreign('settlementWindowId').references('settlementWindowId').inTable('settlementWindow')
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferFulfilment')
}
