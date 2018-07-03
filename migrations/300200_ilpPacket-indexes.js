'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('ilpPacket', (t) => {
    t.index('transferId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('ilpPacket', (t) => {
    t.dropIndex('transferId')
  })
}
