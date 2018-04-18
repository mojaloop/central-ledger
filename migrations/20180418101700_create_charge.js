'use strict'

exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('charge', (t) => {
    t.increments('chargeId').primary()
    t.string('chargeType', 256).notNullable()
    t.string('name', 256).notNullable()
    t.string('payerParticipantId', 256).notNullable()
    t.string('payeeParticipantId', 256).notNullable()
    t.decimal('rate', 10, 2).notNullable().defaultTo(0)
    t.string('rateType', 256).notNullable()
    t.decimal('minimum', 10, 2).nullable()
    t.decimal('maximum', 10, 2).nullable()
    t.string('code', 256).nullable()
    t.boolean('isActive').notNullable().defaultTo(false)
    t.timestamp('createdDate').notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('charge')
}
