'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('transferParticipantRoleType', (t) => {
    t.unique('name')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('transferParticipantRoleType', (t) => {
    t.dropUnique('name')
  })
}
