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

const migrate = async (knex) => {
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
  // rename current tables to preserve currently stored data
  await knex.schema.renameTable('transferExtension', `transferExtension${tableNameSuffix}`)
  await knex.schema.renameTable('transferFulfilmentDuplicateCheck', `transferFulfilmentDuplicateCheck${tableNameSuffix}`)
  await knex.schema.renameTable('transferFulfilment', `transferFulfilment${tableNameSuffix}`)

  // create new table for storing transferExtension, with isFulfilment column in place of transferFulfilmentId
  await knex.schema.createTable('transferExtension', (t) => {
    t.bigIncrements('transferExtensionId').primary().notNullable()
    t.string('transferId', 36).notNullable()
    t.foreign('transferId').references('transferId').inTable('transfer')
    t.bigInteger('transferErrorId').unsigned().defaultTo(null).nullable().references('transferErrorId').inTable('transferError')
    t.boolean('isFulfilment').defaultTo(false).notNullable()
    t.string('key', 128).notNullable()
    t.text('value').notNullable()
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

  let count = 0

  count = await transferExtensionRecordCount(knex, tableNameSuffix)
  if (count) { // copy transferExtension data
    await knex.raw(`
    insert into transferExtension (transferExtensionId, transferId, transferErrorId, isFulfilment, \`key\`, \`value\`, createdDate)
    select te.transferExtensionId, te.transferId, te.transferErrorId, case when te.transferFulfilmentId is null then 0 else 1 end, te.\`key\`, te.\`value\`, te.createdDate
    from transferExtension${tableNameSuffix} as te`)
  } else {
    await knex.schema.dropTableIfExists(`transferExtension${tableNameSuffix}`)
  }

  count = await transferFulfilmentDuplicateCheckRecordCount(knex, tableNameSuffix)
  if (count) { // copy transferFulfilmentDuplicateCheck data (to match copied data by the next statement)
    await knex.raw(`
    insert into transferFulfilmentDuplicateCheck (transferId, \`hash\`, createdDate)
    select transferId, \`hash\`, createdDate from transferFulfilmentDuplicateCheck${tableNameSuffix}
    where transferFulfilmentId in(
      select transferFulfilmentId
      from (
        select transferFulfilmentId, transferId, ilpFulfilment, completedDate, isValid, settlementWindowId, createdDate,
          row_number() over(partition by transferId order by isValid desc, createdDate) rowNumber
        from transferFulfilment${tableNameSuffix}) t
      where t.rowNumber = 1)`)
  } else {
    await knex.schema.dropTableIfExists(`transferFulfilmentDuplicateCheck${tableNameSuffix}`)
  }

  count = await transferFulfilmentRecordCount(knex, tableNameSuffix)
  if (count) { // copy transferFulfilment data and skip duplicates (which were possible before current feature)
    await knex.raw(`
    insert into transferFulfilment (transferId, ilpFulfilment, completedDate, isValid, settlementWindowId, createdDate)
    select t.transferId, t.ilpFulfilment, t.completedDate, t.isValid, t.settlementWindowId, t.createdDate
    from (
      select transferFulfilmentId, transferId, ilpFulfilment, completedDate, isValid, settlementWindowId, createdDate,
        row_number() over(partition by transferId order by isValid desc, createdDate) rowNumber
      from transferFulfilment${tableNameSuffix}) t
    where t.rowNumber = 1`)
  } else {
    await knex.schema.dropTableIfExists(`transferFulfilment${tableNameSuffix}`)
  }

  return 0
}

exports.up = async (knex, Promise) => {
  return await migrate(knex)
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferFulfilmentDuplicateCheck')
}
