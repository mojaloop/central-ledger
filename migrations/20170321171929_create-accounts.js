'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('accounts', (t) => {
    t.increments('accountId').notNullable().primary().defaultTo(1)
    t.string('name', 256).notNullable()
    t.timestamp('createdDate').notNullable().defaultTo(knex.fn.now())
    t.boolean('isDisabled').notNullable().defaultTo(false)
    t.string('emailAddress', 256).notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('accounts')
}
