'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('party', (t) => {
        t.bigIncrements('partyId').primary()

        t.integer('partyTypeId').unsigned().nullable()
        t.foreign('partyTypeId').references('partyTypeId').inTable('partyType')

        t.string('typeValue', 256).nullable()
        t.string('key', 256).notNullable()
        t.string('firstName', 128).notNullable()
        t.string('middleName', 128).nullable()
        t.string('lastName', 128).notNullable()
        t.boolean('isActive').defaultTo(true).notNullable()
        t.string('password', 512).nullable()

        t.integer('partyIdentifierTypeId').unsigned().nullable()
        t.foreign('partyIdentifierTypeId').references('partyIdentifierTypeId').inTable('partyIdentifierType')

        t.string('identifierOther', 50).nullable()
        t.string('identifierValue', 50).nullable()
        t.dateTime('dateOfBirth').nullable()
        t.timestamp('createdDate').defaultTo(knex.fn.now()).notNullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('party')
}
