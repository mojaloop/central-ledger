'use strict'

exports.up = function(knex, Promise) {
    return knex.schema.createTableIfNotExists('transferTopicIndex', (t) => {
        t.bigIncrements('transferTopicIndexId').primary().notNullable()

        t.bigInteger('topicNameId').unsigned().notNullable()
        t.foreign('topicNameId').references('topicNameId').inTable('topicName')

        t.string('transferId', 36).notNullable()
        t.foreign('transferId').references('transferId').inTable('transfer')

        t.bigInteger('value').unsigned().notNullable()
        t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
    })
}

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists('transferTopicIndex')
}
