'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('token', (t) => {
    t.unique('name', 'transferstate_name_unique')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('token', (t) => {
    t.dropUnique('name', 'transferstate_name_unique')
  })
}
