'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('ilpPacket', (t) => {
    t.bigIncrements('transferId').primary().notNullable()

    t.string('transferId', 36).notNullable()
    t.foreign('transferId').references('transferId').inTable('transfer')

    t.text('value').notNullable().comment('ilpPacket')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('ilpPacket')
}
