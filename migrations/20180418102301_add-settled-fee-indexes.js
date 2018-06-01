'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('settledFee', (t) => {
    t.index('feeId')
    t.index('settlementId')
    t.unique(['feeId', 'settlementId'])
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('settledFee', (t) => {
    t.dropIndex('feeId')
    t.dropIndex('settlementId')
    t.dropUnique(['feeId', 'settlementId'])
  })
}
