'use strict'

exports.up = async (knex) => {
  return await knex.schema.hasTable('fxTransferErrorDuplicateCheck').then(function (exists) {
    if (!exists) {
      return knex.schema.createTable('fxTransferErrorDuplicateCheck', (t) => {
        t.string('commitRequestId', 36).primary().notNullable()
        t.string('hash', 256).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('fxTransferErrorDuplicateCheck')
}
