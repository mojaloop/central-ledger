'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('token', (t) => {
    t.index('participantId')
    t.unique('value', 'token_value_unique')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('token', (t) => {
    t.dropIndex('participantId')
    t.dropUnique('value', 'token_value_unique')
  })
}
