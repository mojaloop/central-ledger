'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('participant', (t) => {
    t.bigIncrements('participantId').unsigned().primary()
    t.integer('currencyId').unsigned().notNullable()
    t.foreign('currencyId').references('currency.currencyId')
    t.string('name', 256).notNullable()
    t.timestamp('createdDate').notNullable().defaultTo(knex.fn.now())
    t.boolean('isDisabled').notNullable().defaultTo(false)
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('participant')
}
