'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('settlement', (t) => {
    t.index('transferSettlementBatchId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('settlement', (t) => {
    t.dropIndex('transferSettlementBatchId')
  })
}
