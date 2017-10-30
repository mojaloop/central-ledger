'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.table('fees', (t) => {
    t.index('payerAccountId')
    t.index('payeeAccountId')
    t.index('chargeId')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.table('fees', (t) => {
    t.dropIndex('payerAccountId')
    t.dropIndex('payeeAccountId')
    t.dropIndex('chargeId')
  })
}
