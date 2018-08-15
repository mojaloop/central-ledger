'use strict'

exports.up = function (knex, Promise) {
  return knex.schema.table('segment', (t) => {
    t.index(['segmentType', 'enumeration', 'tableName'], 'segment_keys_index')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.table('segment', (t) => {
    t.dropIndex(['segmentType', 'enumeration', 'tableName'], 'segment_keys_index')
  })
}
