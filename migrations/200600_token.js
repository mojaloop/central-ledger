'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('token', (t) => {
    t.increments('tokenId').primary().notNullable()

    t.integer('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participantId').inTable('participant')

    t.string('value', 256).notNullable()
    // t.text('value').notNullable()
    t.bigInteger('expiration').defaultTo(null).nullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('token')
}
