'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('transferState').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('transferState', (t) => {
        t.string('transferStateId', 50).primary().notNullable()
        t.string('enumeration', 50).notNullable().comment('transferState associated to the Mojaloop API')
        t.string('description', 512).defaultTo(null).nullable()
        t.boolean('isActive').defaultTo(true).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferState')
}
