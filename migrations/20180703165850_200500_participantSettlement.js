'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('participantSettlement', (t) => {
    t.bigIncrements('participantSettlementId').primary().notNullable()

    t.integer('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participantId').inTable('participant')

    t.string('participantNumber', 16).notNullable()
    t.string('routingNumber', 16).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantSettlement')
}
