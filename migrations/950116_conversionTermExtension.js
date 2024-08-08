// Notes: these changes are required for the quoting-service and are not used by central-ledger
'use strict'

exports.up = (knex) => {
  return knex.schema.hasTable('conversionTermExtension').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('conversionTermExtension', (t) => {
        // TODO
      })
    }
  })
}

exports.down = (knex) => {
  return knex.schema.dropTableIfExists('conversionTermExtension')
}
