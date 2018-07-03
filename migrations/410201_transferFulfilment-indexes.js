'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transferFulfilment', (t) => {
    t.index('transferId')
    t.index('settlementWindowId')
    t.unique(['transferId', 'ilpFulfilment'])
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transferFulfilment', (t) => {
    t.dropIndex('transferId')
    t.dropIndex('settlementWindowId')
    t.unique(['transferId', 'ilpFulfilment'])
  })
}
