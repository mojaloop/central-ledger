'use strict'

exports.up = async (knex) => {
  return await knex.schema.hasTable('participantProxy').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('participantProxy', (t) => {
        t.increments('participantProxyId').primary().notNullable()
        t.integer('participantId').unsigned().notNullable()
        t.foreign('participantId').references('participantId').inTable('participant')
        t.boolean('isProxy').defaultTo(false).notNullable()
      })
    }
  })
}

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('participantProxy')
}
