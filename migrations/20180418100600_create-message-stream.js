'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('messageStream', (t) => {
    t.increments('messageStreamId').primary()
    t.string('topicName', 128).notNullable()
    t.integer('topicIndex').notNullable()
    t.dateTime('changedDate').defaultTo(knex.fn.now()).notNullable()
    t.string('changedBy', 128).notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('messageStream')
}
