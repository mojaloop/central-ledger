'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transferExtension', (t) => {
    t.index('transferId')
    t.index('transferFulfilmentId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transferExtension', (t) => {
    t.dropIndex('transferId')
    t.dropIndex('transferFulfilmentId')
  })
}
