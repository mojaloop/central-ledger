/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

'use strict'

const Time = require('../src/lib/time')

const transferExtensionRecordCount = async (knex, nameSuffix) => {
  const result = await knex(`transferExtension${nameSuffix}`).count({ count: '*' }).first()
  return result.count
}
const transferFulfilmentDuplicateCheckRecordCount = async (knex, nameSuffix) => {
  const result = await knex(`transferFulfilmentDuplicateCheck${nameSuffix}`).count({ count: '*' }).first()
  return result.count
}

const transferFulfilmentRecordCount = async (knex, nameSuffix) => {
  const result = await knex(`transferFulfilment${nameSuffix}`).count({ count: '*' }).first()
  return result.count
}

const transferErrorDuplicateCheckRecordCount = async (knex, nameSuffix) => {
  const result = await knex(`transferErrorDuplicateCheck${nameSuffix}`).count({ count: '*' }).first()
  return result.count
}

const transferErrorRecordCount = async (knex, nameSuffix) => {
  const result = await knex(`transferError${nameSuffix}`).count({ count: '*' }).first()
  return result.count
}

const migrateDDL = async (knex) => {
  const tableNameSuffix = Time.getYMDString(new Date())

  // drop foreign keys to make names available to replacing table
  await knex.schema.table(`transferExtension`, (t) => {
    t.dropForeign('transferid')
    t.dropForeign('transfererrorid')
    t.dropForeign('transferfulfilmentid')
  })
  // drop foreign keys to make names available to replacing table
  await knex.schema.table(`transferFulfilment`, (t) => {
    t.dropForeign('transferid')
    t.dropForeign('settlementwindowid')
    t.dropForeign('transferfulfilmentid')
  })
  // drop foreign keys to make names available to replacing table
  await knex.schema.table(`transferError`, (t) => {
      t.dropForeign('transferstatechangeid')
      t.dropForeign('transfererrorduplicatecheckid')
  })
  // drop foreign keys to make names available to replacing table
  await knex.schema.table(`transferErrorDuplicateCheck`, (t) => {
      t.dropForeign('transferid')
  })
  // rename   current tables to preserve currently stored data
  await knex.schema.renameTable('transferExtension', `transferExtension${tableNameSuffix}`)
  await knex.schema.renameTable('transferFulfilmentDuplicateCheck', `transferFulfilmentDuplicateCheck${tableNameSuffix}`)
  await knex.schema.renameTable('transferFulfilment', `transferFulfilment${tableNameSuffix}`)
  await knex.schema.renameTable('transferErrorDuplicateCheck', `transferErrorDuplicateCheck${tableNameSuffix}`)
  await knex.schema.renameTable('transferError', `transferError${tableNameSuffix}`)

  // create new table for storing transferExtension - isFulfilment, isError boolean columns
  await knex.schema.createTable('transferExtension', (t) => {
    t.bigIncrements('transferExtensionId').primary().notNullable()
    t.string('transferId', 36).notNullable()
    t.foreign('transferId').references('transferId').inTable('transfer')
    t.string('key', 128).notNullable()
    t.text('value').notNullable()
    t.boolean('isFulfilment').defaultTo(false).notNullable()
    t.boolean('isError').defaultTo(false).notNullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
  // create new table for storing transferFulfilment hashes with new primary key - transferId
  await knex.schema.createTable('transferFulfilmentDuplicateCheck', (t) => {
    t.string('transferId', 36).primary().notNullable()
    t.foreign('transferId').references('transferId').inTable('transfer')
    t.string('hash', 256).nullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
  // create new table for storing transferFulfilment records with new primary key - transferId
  await knex.schema.createTable('transferFulfilment', (t) => {
    t.string('transferId', 36).primary().notNullable()
    t.foreign('transferId').references('transferId').inTable('transferFulfilmentDuplicateCheck')
    t.string('ilpFulfilment', 256).nullable()
    t.dateTime('completedDate').notNullable()
    t.boolean('isValid').nullable()
    t.bigInteger('settlementWindowId').unsigned().nullable()
    t.foreign('settlementWindowId').references('settlementWindowId').inTable('settlementWindow')
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
  // create new table for storing transferError hashes with new primary key - transferId
  await knex.schema.createTable('transferErrorDuplicateCheck', (t) => {
    t.string('transferId', 36).primary().notNullable()
    t.foreign('transferId').references('transferId').inTable('transfer')
    t.string('hash', 256).nullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
  // create new table for storing transferError records with new primary key - transferId
  await knex.schema.createTable('transferError', (t) => {
    t.string('transferId', 36).primary().notNullable()
    t.foreign('transferId').references('transferId').inTable('transferErrorDuplicateCheck')
    t.bigInteger('transferStateChangeId').unsigned().notNullable()
    t.foreign('transferStateChangeId').references('transferStateChangeId').inTable('transferStateChange')
    t.integer('errorCode').unsigned().notNullable()
    t.string('errorDescription', 128).notNullable()
    t.dateTime('createdDate').defaultTo(knex.fn.now()).notNullable()
  })
  let count = 0
  count = await transferExtensionRecordCount(knex, tableNameSuffix)
  if (!count) {
    await knex.schema.dropTableIfExists(`transferExtension${tableNameSuffix}`)
  }
  count = await transferFulfilmentDuplicateCheckRecordCount(knex, tableNameSuffix)
  if (!count) {
    await knex.schema.dropTableIfExists(`transferFulfilmentDuplicateCheck${tableNameSuffix}`)
  }
  count = await transferFulfilmentRecordCount(knex, tableNameSuffix)
  if (!count) {
    await knex.schema.dropTableIfExists(`transferFulfilment${tableNameSuffix}`)
  }
  count = await transferErrorDuplicateCheckRecordCount(knex, tableNameSuffix)
  if (!count) {
    await knex.schema.dropTableIfExists(`transferErrorDuplicateCheck${tableNameSuffix}`)
  }
  count = await transferErrorRecordCount(knex, tableNameSuffix)
  if (!count) {
    await knex.schema.dropTableIfExists(`transferError${tableNameSuffix}`)
  }
  return 0
}

exports.up = async (knex, Promise) => {
  return await migrateDDL(knex)
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferFulfilmentDuplicateCheck')
}
