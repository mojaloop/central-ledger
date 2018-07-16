'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('participantPositionChange').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('participantPositionChange', (t) => {
        t.bigIncrements('participantPositionChangeId').primary().notNullable()
        t.bigInteger('participantPositionId').unsigned().notNullable()
        t.foreign('participantPositionId').references('participantPositionId').inTable('participantPosition')
        t.bigInteger('transferStateChangeId').unsigned().notNullable()
        t.foreign('transferStateChangeId').references('transferStateChangeId').inTable('transferStateChange')
        t.decimal('value', 18, 2).notNullable()
        t.decimal('reservedValue', 18, 2).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantPositionChange')
}
