'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('transferFulfilment').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('transferFulfilment', (t) => {
        t.string('transferFulfilmentId', 36).primary().notNullable()
        // TODO: enable when transferFulfilmentDuplicateCheck is performed
        // t.foreign('transferFulfilmentId').references('transferFulfilmentId').inTable('transferFulfilmentDuplicateCheck')
        t.string('transferId', 36).notNullable()
        t.foreign('transferId').references('transferId').inTable('transfer')
        t.string('ilpFulfilment', 256).notNullable()
        t.dateTime('completedDate').notNullable()
        t.boolean('isValid').nullable()
        t.bigInteger('settlementWindowId').unsigned().nullable()
        t.foreign('settlementWindowId').references('settlementWindowId').inTable('settlementWindow')
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferFulfilment')
}
