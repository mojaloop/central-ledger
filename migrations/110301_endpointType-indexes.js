'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('endpointType', (t) => {
    t.unique('name')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('endpointType', (t) => {
    t.dropUnique('name')
  })
}
