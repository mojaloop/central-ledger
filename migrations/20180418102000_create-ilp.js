'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('ilp', (t) => {
    t.increments('ilpId').primary()
    
    t.string('transferId', 36).notNullable()
    t.foreign('transferId').references('transferId').inTable('transfer')

    t.text('packet').notNullable()
    t.string('condition', 48).notNullable()
    t.string('fulfillment', 48).nullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('ilp')
}

