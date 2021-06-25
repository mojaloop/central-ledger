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
 * @module src/models/transfer/transferErrorDuplicateCheck/
 */

const Db = require('../../lib/db')
const Logger = require('@mojaloop/central-services-logger')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

/**
 * @function GetTransferFulfilmentDuplicateCheck
 *
 * @async
 * @description This retrieves the transferFulfilmentDuplicateCheck table record if present
 *
 * @param {string} transferId - the transfer id
 *
 * @returns {object} - Returns the record from transferFulfilmentDuplicateCheck table, or throws an error if failed
 */

const getTransferErrorDuplicateCheck = async (transferId) => {
  Logger.isDebugEnabled && Logger.debug(`get transferErrorDuplicateCheck (transferId=${transferId})`)
  try {
    return Db.from('transferErrorDuplicateCheck').findOne({ transferId })
  } catch (err) {
    throw new Error(err.message)
  }
}

/**
 * @function SaveTransferErrorDuplicateCheck
 *
 * @async
 * @description This inserts a record into transferErrorDuplicateCheck table
 *
 * @param {string} transferId - the transfer id
 * @param {string} hash - the hash of the transfer fulfilment request payload
 *
 * @returns {integer} - Returns the database id of the inserted row, or throws an error if failed
 */

const saveTransferErrorDuplicateCheck = async (transferId, hash) => {
  Logger.isDebugEnabled && Logger.debug(`save transferErrorDuplicateCheck (transferId=${transferId}, hash=${hash})`)
  try {
    return Db.from('transferErrorDuplicateCheck').insert({ transferId, hash })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  getTransferErrorDuplicateCheck,
  saveTransferErrorDuplicateCheck
}
