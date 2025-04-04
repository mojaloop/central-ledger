/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * @module src/models/transfer/transferError/
 */

const Db = require('../../lib/db')
const Logger = require('../../shared/logger').logger
const rethrow = require('../../shared/rethrow')

/**
 * @function Insert
 *
 * @async
 * @description This will insert a record into the transferError table for the latest transfer state change id.
 *
 * @param {string} transferStateChangeId - the transferStateChange id
 * @param {string} errorCode - the error code
 * @param {string} errorDescription - the description error
 *
 * @returns {integer} - Returns the id of the transferError record if successful, or throws an error if failed
 */

const insert = async (transferId, transferStateChangeId, errorCode, errorDescription) => {
  Logger.isDebugEnabled && Logger.debug(`insert transferError - errorCode: ${errorCode}, errorDesc: ${errorDescription}`)
  try {
    return Db.from('transferError').insert({ transferId, transferStateChangeId, errorCode, errorDescription })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

/**
 * @function GetByTransferStateChangeId
 *
 * @async
 * @description This will return the record from transferError table for the given transfer state change id.
 *
 * @param {string} transferStateChangeId - the transferStateChange id
 *
 * @returns {object} - Returns the record from transferError if exists or null, or throws an error if failed
 * Example:
 * ```
 * {
 *    transferErrorId: 1,
 *    transferStateChangeId: 1,
 *    errorCode: '3100',
 *    errorDescription: 'Amount 100.123 exceeds allowed scale of 2',
 *    createdDate: '2018-08-17 09:40:28'
 * }
 * ```
 */

const getByTransferStateChangeId = async (transferStateChangeId) => {
  try {
    return Db.from('transferError').find({ transferStateChangeId })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

/**
 * @function GetByTransferId
 *
 * @async
 * @description This will return the last record from transferError table for the given transfer by transferId.
 *
 * @param {string} id - the transferId
 *
 * @returns {object} - Returns the record from transferError if exists or null, or throws an error if failed
 * Example:
 * ```
 * {
 *    transferErrorId: 1,
 *    transferStateChangeId: 1,
 *    errorCode: '3100',
 *    errorDescription: 'Amount 100.123 exceeds allowed scale of 2',
 *    createdDate: '2018-08-17 09:40:28'
 * }
 * ```
 */

const getByTransferId = async (id) => {
  try {
    const transferError = await Db.from('transferError').query(async (builder) => {
      const result = builder
        .where({ transferId: id })
        .select('*')
        .first()
      return result
    })
    transferError.errorCode = transferError.errorCode.toString()
    return transferError
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

module.exports = {
  insert,
  getByTransferStateChangeId,
  getByTransferId
}
