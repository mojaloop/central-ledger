'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('participantLimit').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('participantLimit', (t) => {
        t.increments('participantLimitId').primary().notNullable()
        t.integer('participantCurrencyId').unsigned().notNullable()
        t.foreign('participantCurrencyId').references('participantCurrencyId').inTable('participantCurrency')
        t.integer('participantLimitTypeId').unsigned().notNullable()
        t.foreign('participantLimitTypeId').references('participantLimitTypeId').inTable('participantLimitType')
        t.decimal('value', 18, 2).defaultTo(0).notNullable()
        t.decimal('thresholdAlarmPercentage', 5, 2).defaultTo(10).notNullable()
        t.bigInteger('startAfterParticipantPositionChangeId').unsigned().nullable()
        t.foreign('startAfterParticipantPositionChangeId').references('participantPositionChangeId').inTable('participantPositionChange')
        t.boolean('isActive').defaultTo(true).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
        t.string('createdBy', 128).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantLimit')
}
