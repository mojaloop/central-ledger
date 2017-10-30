'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('userRoles', (t) => {
    t.uuid('userId')
    t.foreign('userId').references('users.userId')
    t.uuid('roleId')
    t.foreign('roleId').references('roles.roleId')
    t.primary(['userId', 'roleId'])
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('userRoles')
}
