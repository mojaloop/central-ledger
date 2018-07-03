'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transferFulfilmentDuplicateCheck', (t) => {
    t.index('transferId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transferFulfilmentDuplicateCheck', (t) => {
    t.dropIndex('transferId')
  })
}
