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

    // TODO: get the proper values for the quoteId from the ilpPacket
    // for demo purposes let's just set them to 12345
    await knex('transfer')
      .where({quoteId: null})
      .update({quoteId: '12345'})

    return knex.schema.table('transfer', t => {
      t.string('quoteId', 36).notNullable().alter()
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
        // TODO: there is no easy way to undo the migration of null fields to non-null
        // but maybe we need to think about it

        t.string('quoteId', 36).nullable().defaultTo(null).alter()
      })
    })
}
