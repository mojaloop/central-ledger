'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('fspSettlement', (t) => {
        t.increments('fspSettlementId').primary()

        t.integer('fspId').unsigned().notNullable()
        t.foreign('fspId').references('fspId').inTable('fsp')

        t.string('fspNumber', 16).notNullable()
        t.string('routingNumber', 16).notNullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('fspSettlement')
}
