'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('participantLimit', (t) => {
    t.index('participantId')
    t.index('type')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('participantLimit', (t) => {
    t.dropIndex('participantId')
    t.dropIndex('type')
  })
}
