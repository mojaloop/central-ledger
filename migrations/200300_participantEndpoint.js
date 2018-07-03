'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('participantEndpoint', (t) => {
    t.increments('participantEndpointId').primary().notNullable()
    t.integer('participantId').unsigned().notNullable()
    t.foreign('participantId').references('participantId').inTable('participant')
    t.integer('endpointTypeId').unsigned().notNullable()
    t.foreign('endpointTypeId').references('endpointTypeId').inTable('endpointType')
    t.string('value', 512).notNullable()
    t.boolean('isActive').defaultTo(true).notNullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
    t.string('createdBy', 128).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('participantEndpoint')
}
