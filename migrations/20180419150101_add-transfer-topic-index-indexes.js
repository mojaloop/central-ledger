'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transferEventIndex', (t) => {
    t.index('eventNameId')
    t.index('transferId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transferEventIndex', (t) => {
    t.dropIndex('eventNameId')
    t.dropIndex('transferId')
  })
}
