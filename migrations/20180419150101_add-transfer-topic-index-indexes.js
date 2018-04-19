'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.table('transferTopicIndex', (t) => {
        t.index('topicNameId')
        t.index('transferId')
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.table('transferTopicIndex', (t) => {
        t.dropIndex('topicNameId')
        t.dropIndex('transferId')
    })
}
