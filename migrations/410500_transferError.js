'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('transferError').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('transferError', (t) => {
        t.bigIncrements('transferErrorId').primary().notNullable()
        t.bigInteger('transferStateChangeId').unsigned().notNullable()
        t.foreign('transferStateChangeId').references('transferStateChangeId').inTable('transferStateChange')
        t.integer('errorCode').unsigned().notNullable()
        t.string('errorDescription', 128).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferError')
}
