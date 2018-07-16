'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('transferFulfilmentDuplicateCheck').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('transferFulfilmentDuplicateCheck', (t) => {
        t.string('transferFulfilmentId', 36).primary().notNullable()
        t.string('transferId', 36).notNullable()
        t.foreign('transferId').references('transferId').inTable('transfer')
        t.string('hash', 256).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferFulfilmentDuplicateCheck')
}
