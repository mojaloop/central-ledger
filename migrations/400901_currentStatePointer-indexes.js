'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('currentStatePointer', (t) => {
    t.unique(['entityName', 'entityId'])
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('currentStatePointer', (t) => {
    t.dropUnique(['entityName', 'entityId'])
  })
}
