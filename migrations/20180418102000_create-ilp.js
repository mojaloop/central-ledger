'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('ilp', (t) => {
    t.bigIncrements('ilpId').primary().notNullable()

    t.string('transferId', 36).notNullable()
    t.foreign('transferId').references('transferId').inTable('transfer')

    t.text('packet').notNullable().comment('ilpPacket')
    t.string('condition', 256).notNullable()
    t.string('fulfilment', 256).defaultTo(null).nullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('ilp')
}
