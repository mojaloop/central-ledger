'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('settlement').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('settlement', (t) => {
        t.bigIncrements('settlementId').primary().notNullable()
        t.string('reason', 512).defaultTo(null).nullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('settlement')
}
