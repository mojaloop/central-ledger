'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('participantPositionChange', (t) => {
    t.bigIncrements('participantPositionChangeId').primary().notNullable()
    t.bigInteger('participantPositionId').notNullable()
    t.foreign('participantPositionId').references('participantPositionId').inTable('participantPosition')
    t.bigInteger('transferStateChangeId').notNullable()
    t.foreign('transferStateChangeId').references('transferStateChangeId').inTable('transferStateChange')
    t.decimal('value', 18, 2).notNullable()
    t.decimal('reservedValue', 18, 2).notNullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantPositionChange')
}
