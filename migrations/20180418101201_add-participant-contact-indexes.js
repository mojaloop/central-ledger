'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('participantContact', (t) => {
    t.index('participantId')
    t.index('contactTypeId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('participantContact', (t) => {
    t.dropIndex('participantId')
    t.dropIndex('contactTypeId')
  })
}
