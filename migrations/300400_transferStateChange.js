'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('transferStateChange').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('transferStateChange', (t) => {
        t.bigIncrements('transferStateChangeId').primary().notNullable()
        t.string('transferId', 36).notNullable()
        t.foreign('transferId').references('transferId').inTable('transfer')
        t.string('transferStateId', 50).notNullable()
        t.foreign('transferStateId').references('transferStateId').inTable('transferState')
        t.string('reason', 512).defaultTo(null).nullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferStateChange')
}
