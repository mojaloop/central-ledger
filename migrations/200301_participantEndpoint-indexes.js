'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('participantEndpoint', (t) => {
    t.index('participantId')
    t.index('endpointTypeId')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('participantEndpoint', (t) => {
    t.dropIndex('participantId')
    t.dropIndex('endpointTypeId')
  })
}
