'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('transferExtension').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('transferExtension', (t) => {
        t.bigIncrements('transferExtensionId').primary().notNullable()
        t.string('transferId', 36).notNullable()
        t.foreign('transferId').references('transferId').inTable('transfer')
        t.string('transferFulfilmentId', 36).defaultTo(null).nullable()
        t.foreign('transferFulfilmentId').references('transferFulfilmentId').inTable('transferFulfilment')
        t.string('key', 128).notNullable()
        t.text('value').notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferExtension')
}
