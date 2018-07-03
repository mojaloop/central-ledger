'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('participantLimitType', (t) => {
    t.unique('name')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('participantLimitType', (t) => {
    t.dropUnique('name')
  })
}
