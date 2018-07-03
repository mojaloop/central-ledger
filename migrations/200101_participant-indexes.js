'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('participant', (t) => {
    t.unique('name')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('participant', (t) => {
    t.dropUnique('name')
  })
}
