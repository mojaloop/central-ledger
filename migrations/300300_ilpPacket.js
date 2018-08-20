'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('ilpPacket').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('ilpPacket', (t) => {
        t.string('transferId', 36).primary().notNullable()
        t.foreign('transferId').references('transferId').inTable('transfer')
        t.text('value').notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('ilpPacket')
}
