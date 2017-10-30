'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('userCredentials', (t) => {
    t.index('accountId')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('userCredentials', (t) => {
    t.dropIndex('accountId')
  })
}
