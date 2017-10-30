'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('roles', (t) => {
    t.uuid('roleId').primary()
    t.string('name', 256).notNullable()
    t.string('description', 1000).nullable()
    t.text('permissions').notNullable()
    t.timestamp('createdDate').notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('roles')
}
