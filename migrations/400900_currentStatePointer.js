'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('currentStatePointer').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('currentStatePointer', (t) => {
        t.bigIncrements('currentStatePointerId').primary().notNullable()
        t.string('entityName', 50).notNullable()
        t.bigInteger('entityId').unsigned().notNullable()
        t.bigInteger('stateChangeId').unsigned().notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('currentStatePointer')
}
