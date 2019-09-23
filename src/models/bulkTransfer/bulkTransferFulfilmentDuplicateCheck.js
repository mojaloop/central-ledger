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

/**
 * @module src/models/bulkTransfer/bulkTransferFulfilmentDuplicateCheck/
 */

const Db = require('../../lib/db')
const Logger = require('@mojaloop/central-services-logger')

/**
 * @function CheckDuplicate
 *
 * @async
 * @description This checks if there is a matching hash for a bulkTransfer request in bulkTransferFulfilmentDuplicateCheck table, if it does not exist, it will be inserted
 *
 * @param {string} bulkTransferId - the bulkTransfer id
 * @param {string} hash - the hash of the bulkTransfer request payload
 *
 * @returns {object} - Returns the hash if exists, otherwise null, or throws an error if failed
 * Example:
 * ```
 * {
 *    bulkTransferId: '9136780b-37e2-457c-8c05-f15dbb033b10',
 *    hash: 'H4epygr6RZNgQs9UkUmRwAJtNnLQ7eB4Q0jmROxcY+8',
 *    createdDate: '2018-08-17 09:46:21'
 * }
 * ```
 */

const checkDuplicate = async (bulkTransferId, hash) => {
  Logger.debug('check and insert hash into bulkTransferFulfilmentDuplicateCheck' + bulkTransferId.toString())
  try {
    const knex = Db.getKnex()
    return knex.transaction(async trx => {
      try {
        let isDuplicateId
        let isResend
        let identity

        const existingHash = await knex('bulkTransferFulfilmentDuplicateCheck').transacting(trx)
          .where({ bulkTransferId: bulkTransferId })
          .select('*')
          .first()

        if (!existingHash) {
          const result = await knex('bulkTransferFulfilmentDuplicateCheck').transacting(trx)
            .insert({ bulkTransferId, hash })
          identity = result[0]
          isDuplicateId = false
          isResend = false
        } else {
          isDuplicateId = true
          isResend = hash === existingHash.hash
        }
        await trx.commit
        return {
          isDuplicateId,
          isResend,
          identity
        }
      } catch (err) {
        await trx.rollback
        throw err
      }
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

module.exports = {
  checkDuplicate
}
