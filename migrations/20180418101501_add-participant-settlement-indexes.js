'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('participantSettlement', (t) => {
    t.index('participantId')
    t.unique('participantId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('participantSettlement', (t) => {
    t.dropIndex('participantId')
    t.dropUnique('participantId')
  })
}
