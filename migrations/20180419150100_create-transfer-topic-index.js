'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('transferEventIndex', (t) => {
    t.bigIncrements('transferEventIndexId').primary().notNullable()

    t.bigInteger('eventNameId').unsigned().notNullable()
    t.foreign('eventNameId').references('eventNameId').inTable('eventName')

    t.string('transferId', 36).notNullable()
    t.foreign('transferId').references('transferId').inTable('transfer')

    t.bigInteger('value').unsigned().notNullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferEventIndex')
}
