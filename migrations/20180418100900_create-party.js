'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.createTableIfNotExists('party', (t) => {
    t.bigIncrements('partyId').primary().notNullable()

    t.integer('partyTypeId').unsigned().nullable()
    t.foreign('partyTypeId').references('partyTypeId').inTable('partyType')

    t.string('typeValue', 256).defaultTo(null).nullable()
    t.string('key', 256).notNullable()
    t.string('firstName', 128).notNullable()
    t.string('middleName', 128).defaultTo(null).nullable()
    t.string('lastName', 128).notNullable()
    t.boolean('isActive').defaultTo(true).notNullable()
    t.string('password', 256).defaultTo(null).nullable()

    t.integer('partyIdentifierTypeId').unsigned().nullable()
    t.foreign('partyIdentifierTypeId').references('partyIdentifierTypeId').inTable('partyIdentifierType')

    t.string('identifierOther', 50).defaultTo(null).nullable()
    t.string('identifierValue', 50).defaultTo(null).nullable()
    t.dateTime('dateOfBirth').defaultTo(null).nullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('party')
}
