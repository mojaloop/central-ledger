'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('transferStateChange', (t) => {
    t.bigIncrements('transferStateChangeId').primary().notNullable()

    t.string('transferId', 36).notNullable()

    // the below foreign key constraint has been moved to the add-transfer-state-foreign-key file
    // t.foreign('transferId').references('transferId').inTable('transfer')

    // t.integer('transferStateId').unsigned().notNullable()
    t.string('transferStateId', 50).notNullable()
    t.foreign('transferStateId').references('transferStateId').inTable('transferState')

    t.text('reason', 'text').defaultTo(null).nullable()

    t.dateTime('changedDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferStateChange')
}
