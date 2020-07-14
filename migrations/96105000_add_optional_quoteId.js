'use strict'

/**
 * Add an optional quoteId field to the transfer table
 */
exports.up = async (knex) => {
  return await knex.schema.hasTable('transfer')
  .then((exists) =>  {
    if (!exists) {
      return;
    }

    return knex.schema.table('transfer', t => {
      t.string('quoteId', 36).nullable()
    })
  })
}

exports.down = async (knex) => {
  return await knex.schema.hasTable('transfer')
    .then((exists) => {
      if (!exists) {
        return;
      }

      return knex.schema.table('transfer', t => {
        t.dropColumn('quoteId')
      })
    })
}
