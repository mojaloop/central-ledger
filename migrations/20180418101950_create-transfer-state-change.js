'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('transferStateChange', (t) => {
    t.bigIncrements('transferStateChangeId').primary().notNullable()

    t.string('transferId', 36).notNullable()
    t.foreign('transferId').references('transferId').inTable('transfer')

    t.string('transferStateId', 50).notNullable()
    t.foreign('transferStateId').references('transferStateId').inTable('transferState')

    t.text('reason', 'text').defaultTo(null).nullable()

    t.dateTime('changedDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferStateChange')
}
