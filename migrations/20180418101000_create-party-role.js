'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('partyRole', (t) => {
    t.bigIncrements('partyRoleId').primary().notNullable()

    t.bigInteger('partyId').unsigned().notNullable()
    t.foreign('partyId').references('partyId').inTable('party')

    t.integer('roleId').unsigned().notNullable()
    t.foreign('roleId').references('roleId').inTable('role')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('partyRole')
}
