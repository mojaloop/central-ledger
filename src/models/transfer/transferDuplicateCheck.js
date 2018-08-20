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

 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * @module src/models/transfer/transferDuplicateCheck/
 */

const Db = require('../../db')
const Logger = require('@mojaloop/central-services-shared').Logger

/**
 * @function SaveTransferDuplicateCheck
 *
 * @async
 * @description This inserts a record into transferDuplicateCheck table
 *
 * @param {object} transferDuplicateCheck - the object to be inserted with values of transferId and hash
 * Example:
 * ```
 * {
 *    transferId: '9136780b-37e2-457c-8c05-f15dbb033b10',
 *    hash: 'H4epygr6RZNgQs9UkUmRwAJtNnLQ7eB4Q0jmROxcY+8'
 * }
 * ```
 *
 * @returns {integer} - Returns the database id of the inserted row, or throws an error if failed
 */

const saveTransferDuplicateCheck = async (transferDuplicateCheck) => {
  Logger.debug('save transferDuplicateCheck' + transferDuplicateCheck.toString())
  try {
    return Db.transferDuplicateCheck.insert(transferDuplicateCheck)
  } catch (err) {
    throw new Error(err.message)
  }
}

/**
 * @function CheckAndInsertDuplicateHash
 *
 * @async
 * @description This checks if there is a matching hash for a transfer request in transferDuplicateCheck table, if it does not exist, it will be inserted
 *
 * @param {string} transferId - the transfer id
 * @param {string} hash - the hash of the transfer request payload
 *
 * @returns {object} - Returns the hash if exists, otherwise null, or throws an error if failed
 * Example:
 * ```
 * {
 *    transferId: '9136780b-37e2-457c-8c05-f15dbb033b10',
 *    hash: 'H4epygr6RZNgQs9UkUmRwAJtNnLQ7eB4Q0jmROxcY+8',
 *    createdDate: '2018-08-17 09:46:21'
 * }
 * ```
 */

const checkAndInsertDuplicateHash = async (transferId, hash) => {
  Logger.debug('check and insert hash into  transferDuplicateCheck' + transferId.toString())
  try {
    const knex = Db.getKnex()
    return knex.transaction(async trx => {
      try {
        const existingHash = await knex('transferDuplicateCheck').transacting(trx).select('*').where({ transferId: transferId }).first()

        if (!existingHash) {
          await knex('transferDuplicateCheck').transacting(trx).insert({ transferId, hash })
        }
        await trx.commit
        return existingHash
      } catch (err) {
        await trx.rollback
        throw err
      }
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

// const truncate = async (id) => {
//   try {
//     return await Db.transferStateChange.truncate()
//   } catch (err) {
//     throw err
//   }
// }

module.exports = {
  saveTransferDuplicateCheck,
  // getByTransferId,
  checkAndInsertDuplicateHash
}
