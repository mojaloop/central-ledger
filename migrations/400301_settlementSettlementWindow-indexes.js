'use strict'
'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('settlementSettlementWindow', (t) => {
    t.index('settlementId')
    t.index('settlementWindowId')
    t.unique(['settlementId', 'settlementWindowId'])
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('settlementSettlementWindow', (t) => {
    t.dropIndex('settlementId')
    t.dropIndex('settlementWindowId')
    t.dropUnique(['settlementId', 'settlementWindowId'])
  })
}
