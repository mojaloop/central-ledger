'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('transferTimeout').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('transferTimeout', (t) => {
        t.bigIncrements('transferTimeoutId').primary().notNullable()
        t.string('transferId', 36).notNullable()
        t.foreign('transferId').references('transferId').inTable('transfer')
        t.dateTime('expirationDate').notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferTimeout')
}
