'use strict'

exports.up = async (knex) => {
  return await knex.schema.hasTable('participant').then(function(exists) {
    if (exists) {
      return knex.schema.alterTable('participant', (t) => {
        t.boolean('isProxy').defaultTo(false).notNullable()

      })
    }
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('participant', (t) => {
    t.dropColumn('isProxy')
  })
}
