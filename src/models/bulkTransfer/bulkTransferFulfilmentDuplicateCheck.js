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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/
'use strict'

/**
 * @module src/models/bulkTransfer/BulkTransferFulfilmentDuplicateCheck/
 */

const Db = require('../../lib/db')
const Logger = require('@mojaloop/central-services-logger')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

/**
 * @function GetBulkTransferFulfilmentDuplicateCheck
 *
 * @async
 * @description This retrieves the BulkTransferFulfilmentDuplicateCheck table record if present
 *
 * @param {string} bulkTransferId - the bulk transfer id
 *
 * @returns {object} - Returns the record from BulkTransferFulfilmentDuplicateCheck table, or throws an error if failed
 */

const getBulkTransferFulfilmentDuplicateCheck = async (bulkTransferId) => {
  Logger.isDebugEnabled && Logger.debug(`get BulkTransferFulfilmentDuplicateCheck (bulkTransferId=${bulkTransferId})`)
  try {
    return Db.from('bulkTransferFulfilmentDuplicateCheck').findOne({ bulkTransferId })
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw new Error(err.message)
  }
}

/**
 * @function SaveBulkTransferFulfilmentDuplicateCheck
 *
 * @async
 * @description This inserts a record into BulkTransferFulfilmentDuplicateCheck table
 *
 * @param {string} bulkTransferId - the bulk transfer id
 * @param {string} hash - the hash of the transfer request payload
 *
 * @returns {integer} - Returns the database id of the inserted row, or throws an error if failed
 */

const saveBulkTransferFulfilmentDuplicateCheck = async (bulkTransferId, hash) => {
  Logger.isDebugEnabled && Logger.debug(`save BulkTransferFulfilmentDuplicateCheck (bulkTransferId=${bulkTransferId}, hash=${hash})`)
  try {
    return Db.from('bulkTransferFulfilmentDuplicateCheck').insert({ bulkTransferId, hash })
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  getBulkTransferFulfilmentDuplicateCheck,
  saveBulkTransferFulfilmentDuplicateCheck
}
