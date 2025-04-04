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

 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * @module src/models/transfer/transferDuplicateCheck/
 */

const Db = require('../../lib/db')
const Logger = require('../../shared/logger').logger
const Metrics = require('@mojaloop/central-services-metrics')
const rethrow = require('../../shared/rethrow')

/**
 * @function GetTransferDuplicateCheck
 *
 * @async
 * @description This retrieves the transferDuplicateCheck table record if present
 *
 * @param {string} transferId - the transfer id
 *
 * @returns {object} - Returns the record from transferDuplicateCheck table, or throws an error if failed
 */

const getTransferDuplicateCheck = async (transferId) => {
  const histTimerGetTransferDuplicateCheckEnd = Metrics.getHistogram(
    'model_transfer',
    'transferDuplicateCheck_getTransferDuplicateCheck - Metrics for transfer duplicate check model',
    ['success', 'queryName']
  ).startTimer()
  Logger.isDebugEnabled && Logger.debug(`get transferDuplicateCheck (transferId=${transferId})`)
  try {
    const result = Db.from('transferDuplicateCheck').findOne({ transferId })
    histTimerGetTransferDuplicateCheckEnd({ success: true, queryName: 'transferDuplicateCheck_getTransferDuplicateCheck' })
    return result
  } catch (err) {
    histTimerGetTransferDuplicateCheckEnd({ success: false, queryName: 'transferDuplicateCheck_getTransferDuplicateCheck' })
    rethrow.rethrowDatabaseError(err)
  }
}

/**
 * @function SaveTransferDuplicateCheck
 *
 * @async
 * @description This inserts a record into transferDuplicateCheck table
 *
 * @param {string} transferId - the transfer id
 * @param {string} hash - the hash of the transfer request payload
 *
 * @returns {integer} - Returns the database id of the inserted row, or throws an error if failed
 */

const saveTransferDuplicateCheck = async (transferId, hash) => {
  const histTimerSaveTransferDuplicateCheckEnd = Metrics.getHistogram(
    'model_transfer',
    'transferDuplicateCheck_saveTransferDuplicateCheck - Metrics for transfer duplicate check model',
    ['success', 'queryName']
  ).startTimer()
  Logger.isDebugEnabled && Logger.debug(`save transferDuplicateCheck (transferId=${transferId}, hash=${hash})`)
  try {
    const result = Db.from('transferDuplicateCheck').insert({ transferId, hash })
    histTimerSaveTransferDuplicateCheckEnd({ success: true, queryName: 'transferDuplicateCheck_saveTransferDuplicateCheck' })
    return result
  } catch (err) {
    histTimerSaveTransferDuplicateCheckEnd({ success: false, queryName: 'transferDuplicateCheck_saveTransferDuplicateCheck' })
    rethrow.rethrowDatabaseError(err)
  }
}

module.exports = {
  getTransferDuplicateCheck,
  saveTransferDuplicateCheck
}
