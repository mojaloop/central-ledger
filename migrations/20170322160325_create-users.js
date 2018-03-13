'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('users', (t) => {
    t.uuid('userId').notNullable().primary()
    t.string('key', 256).notNullable()
    t.string('lastName', 128).notNullable()
    t.string('firstName', 128).notNullable()
    t.string('email', 256).nullable()
    t.boolean('isActive').notNullable().defaultTo(true)
    t.timestamp('createdDate').notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('users')
}
