'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('settledFee', (t) => {
        t.increments('settledFeeId').primary()

        t.integer('feeId').unsigned().notNullable()
        t.foreign('feeId').references('feeId').inTable('fee')

        t.integer('settlementId').unsigned().notNullable()
        t.foreign('settlementId').references('settlementId').inTable('settlement')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('settledFee')
}
