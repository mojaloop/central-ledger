'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('token', (t) => {
    t.increments('tokenId').primary().unsigned().defaultTo(1)
    t.integer('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participantId').inTable('participant')
    t.string('value', 1000).notNullable()
    t.bigInteger('expiration').nullable()
    t.timestamp('createdDate').notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('token')
}
