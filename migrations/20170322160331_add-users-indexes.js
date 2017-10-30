'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('users', (t) => {
    t.unique('key')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('users', (t) => {
    t.dropUnique('key')
  })
}
