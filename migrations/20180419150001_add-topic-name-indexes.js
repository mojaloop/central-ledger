'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('topicName', (t) => {
        t.unique('value')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('topicName', (t) => {
        t.dropUnique('value')
    })
}
