'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('transferDuplicateCheck').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('transferDuplicateCheck', (t) => {
        t.string('transferId', 36).primary().notNullable()
        t.foreign('transferId').references('transferId').inTable('transfer')
        t.string('hash', 256).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferDuplicateCheck')
}
