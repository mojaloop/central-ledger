'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('ilp', (t) => {
    t.increments('ilpId').primary()
    t.uuid('transferId').notNullable()
    t.longtext('packet').notNullable()
    t.string('condition',48).notNullable()
    t.string('fulfillment',48).notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('ilp')
}

