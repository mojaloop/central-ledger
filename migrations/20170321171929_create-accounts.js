'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('accounts', (t) => {
    t.increments('accountId').primary()
    t.string('name', 256).notNullable()
    t.timestamp('createdDate').notNullable().defaultTo(knex.fn.now())
    t.boolean('isDisabled').notNullable().defaultTo(false)
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('accounts')
}
