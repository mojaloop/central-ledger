'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('token').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('token', (t) => {
        t.increments('tokenId').primary().notNullable()
        t.integer('participantId').unsigned().notNullable()
        t.foreign('participantId').references('participantId').inTable('participant')
        t.string('value', 256).notNullable()
        t.bigInteger('expiration').defaultTo(null).nullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('token')
}
