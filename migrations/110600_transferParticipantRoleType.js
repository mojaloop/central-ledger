'use strict'

exports.up = async (knex, Promise) => {
  return await knex.schema.hasTable('transferParticipantRoleType').then(function(exists) {
    if (!exists) {
      return knex.schema.createTable('transferParticipantRoleType', (t) => {
        t.increments('transferParticipantRoleTypeId').primary().notNullable()
        t.string('name', 50).notNullable()
        t.string('description', 512).defaultTo(null).nullable()
        t.boolean('isActive').defaultTo(true).notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
      })
    }
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferParticipantRoleType')
}
