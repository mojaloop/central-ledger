'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('participantPositionChange', (t) => {
    t.index('participantPositionId')
    t.index('transferStateChangeId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('participantPositionChange', (t) => {
    t.dropIndex('participantPositionId')
    t.dropIndex('transferStateChangeId')
  })
}
