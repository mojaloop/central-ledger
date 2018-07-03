'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transferState', (t) => {
    t.unique('enumeration')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transferState', (t) => {
    t.dropUnique('enumeration')
  })
}
