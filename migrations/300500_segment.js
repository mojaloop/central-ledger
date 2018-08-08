'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('segment').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('segment', (t) => {
        t.increments('segmentId').primary().notNullable()
        t.string('segmentType', 50).notNullable()
        t.integer('enumeration').notNullable().defaultTo(0)
        t.string('tableName', 50).notNullable()
        t.bigInteger('value').notNullable()
        t.dateTime('changedDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('segment')
}
