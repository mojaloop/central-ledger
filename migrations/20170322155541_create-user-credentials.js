'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('userCredentials', (t) => {
    t.increments('userCredentialId').primary().unsigned().notNullable()
    t.integer('accountId').unsigned().notNullable()
    t.string('password', 512).notNullable()
    t.timestamp('createdDate').notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('userCredentials')
}
