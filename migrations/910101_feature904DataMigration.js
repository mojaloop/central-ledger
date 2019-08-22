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
const EXECUTE_SUGGESTED_DATA_MIGRATION = true

const Time = require('@mojaloop/central-services-shared').Util.Time
const tableNameSuffix = Time.getYMDString(new Date())

/**
 * This migration script is provided with no warranties! Use at your own risk!
 * Make sure you have fresh DB backup before initializing it and also set 
 * `tableNameSuffix` to match the suffix of the tables you want to migrate data from.
 * If you need to execute this script multiple times after failure/modifications,
 * please delete the corresponding record from central_ledger.migration table.
 * After migrating data to the new data structures, drop suffixed tables at your
 * consideration.
 */
const migrateData = async (knex) => {
  return knex.transaction(async trx => {
    try {
      let exists = false
      exists = await knex.schema.hasTable(`transferExtension${tableNameSuffix}`)
      if (exists) {
        await knex.transacting(trx).raw(`
        insert into transferExtension (transferExtensionId, transferId, \`key\`, \`value\`, isFulfilment, isError, createdDate)
        select te.transferExtensionId, te.transferId, te.\`key\`, te.\`value\`,
          case when te.transferFulfilmentId is null then 0 else 1 end,
          case when te.transferErrorId is null then 0 else 1 end,
          te.createdDate
        from transferExtension${tableNameSuffix} as te`)
      }
      exists = await knex.schema.hasTable(`transferFulfilmentDuplicateCheck${tableNameSuffix}`) &&
        await knex.schema.hasTable(`transferFulfilment${tableNameSuffix}`)
      if (exists) {
        await knex.transacting(trx).raw(`
        insert into transferFulfilmentDuplicateCheck (transferId, \`hash\`, createdDate)
        select transferId, \`hash\`, createdDate from transferFulfilmentDuplicateCheck${tableNameSuffix}
        where transferFulfilmentId in(
          select transferFulfilmentId
          from (
            select transferFulfilmentId, transferId, ilpFulfilment, completedDate, isValid, settlementWindowId, createdDate,
              row_number() over(partition by transferId order by isValid desc, createdDate) rowNumber
            from transferFulfilment${tableNameSuffix}) t
          where t.rowNumber = 1)`)
      }
      exists = await knex.schema.hasTable(`transferFulfilment${tableNameSuffix}`)
      if (exists) {
        await knex.transacting(trx).raw(`
        insert into transferFulfilment (transferId, ilpFulfilment, completedDate, isValid, settlementWindowId, createdDate)
        select t.transferId, t.ilpFulfilment, t.completedDate, t.isValid, t.settlementWindowId, t.createdDate
        from (
          select transferFulfilmentId, transferId, ilpFulfilment, completedDate, isValid, settlementWindowId, createdDate,
            row_number() over(partition by transferId order by isValid desc, createdDate) rowNumber
          from transferFulfilment${tableNameSuffix}) t
        where t.rowNumber = 1`)
      }
      exists = await knex.schema.hasTable(`transferErrorDuplicateCheck${tableNameSuffix}`)
      if (exists) {
        await knex.transacting(trx).raw(`
        insert into transferErrorDuplicateCheck (transferId, \`hash\`, createdDate)
        select transferId, \`hash\`, createdDate
        from transferErrorDuplicateCheck${tableNameSuffix}`)
      }
      exists = await knex.schema.hasTable(`transferError${tableNameSuffix}`)
      if (exists) {
        await knex.transacting(trx).raw(`
        insert into transferError (transferId, transferStateChangeId, errorCode, errorDescription, createdDate)
        select tsc.transferId, te.transferStateChangeId, te.errorCode, te.errorDescription, te.createdDate
        from transferError${tableNameSuffix} te
        join transferStateChange tsc on tsc.transferStateChangeId = te.transferStateChangeId`)
      }
      await trx.commit
    } catch (err) {
      await trx.rollback
      throw err
    }
  })
}

exports.up = async (knex, Promise) => {
  if (EXECUTE_SUGGESTED_DATA_MIGRATION) {
    return await migrateData(knex)
  }
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('transferFulfilmentDuplicateCheck')
}
