'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('messageStream', (t) => {
    t.bigIncrements('messageStreamId').unsigned().primary()
    t.string('topicName', 128).notNullable()
    t.decimal('topicIndex', 10, 2).notNullable()
    t.timestamp('changedDate').notNullable().defaultTo(knex.fn.now())
    t.string('changedBy', 128).notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('messageStream')
}
