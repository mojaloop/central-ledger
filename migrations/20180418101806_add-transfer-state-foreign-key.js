'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transferStateChange', (t) => {
    // t.foreign('transferId').references('transferId').inTable('transfer')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transferStateChange', (t) => {

  })
}
