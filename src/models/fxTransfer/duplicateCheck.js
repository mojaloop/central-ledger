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

 * Infitx
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 - Kevin Leyow <kevin.leyow@infitx.com>
 - Kalin Krustev <kalin.krustev@infitx.com>
 - Steven Oderayi <steven.oderayi@infitx.com>
 - Eugen Klymniuk <eugen.klymniuk@infitx.com>

 --------------

 ******/

const Metrics = require('@mojaloop/central-services-metrics')
const Db = require('../../lib/db')
const { logger } = require('../../shared/logger')
const { TABLE_NAMES } = require('../../shared/constants')
const rethrow = require('../../shared/rethrow')

const histName = 'model_fx_transfer'

const getOneByCommitRequestId = async ({ commitRequestId, table, queryName }) => {
  const histTimerEnd = Metrics.getHistogram(
    histName,
    `${queryName} - Metrics for fxTransfer duplicate check model`,
    ['success', 'queryName']
  ).startTimer()
  logger.debug('get duplicate record', { commitRequestId, table, queryName })

  try {
    const result = await Db.from(table).findOne({ commitRequestId })
    histTimerEnd({ success: true, queryName })
    return result
  } catch (err) {
    histTimerEnd({ success: false, queryName })
    rethrow.rethrowDatabaseError(err)
  }
}

const saveCommitRequestIdAndHash = async ({ commitRequestId, hash, table, queryName }) => {
  const histTimerEnd = Metrics.getHistogram(
    histName,
    `${queryName} - Metrics for fxTransfer duplicate check model`,
    ['success', 'queryName']
  ).startTimer()
  logger.debug('save duplicate record', { commitRequestId, hash, table })

  try {
    const result = await Db.from(table).insert({ commitRequestId, hash })
    histTimerEnd({ success: true, queryName })
    return result
  } catch (err) {
    histTimerEnd({ success: false, queryName })
    rethrow.rethrowDatabaseError(err)
  }
}

/**
 * @function GetTransferDuplicateCheck
 *
 * @async
 * @description This retrieves the fxTransferDuplicateCheck table record if present
 *
 * @param {string} commitRequestId - the fxTransfer commitRequestId
 *
 * @returns {object} - Returns the record from fxTransferDuplicateCheck table, or throws an error if failed
 */
const getFxTransferDuplicateCheck = async (commitRequestId) => {
  const table = TABLE_NAMES.fxTransferDuplicateCheck
  const queryName = `${table}_getFxTransferDuplicateCheck`
  return getOneByCommitRequestId({ commitRequestId, table, queryName })
}

/**
 * @function SaveTransferDuplicateCheck
 *
 * @async
 * @description This inserts a record into fxTransferDuplicateCheck table
 *
 * @param {string} commitRequestId - the fxTransfer commitRequestId
 * @param {string} hash - the hash of the fxTransfer request payload
 *
 * @returns {integer} - Returns the database id of the inserted row, or throws an error if failed
 */
const saveFxTransferDuplicateCheck = async (commitRequestId, hash) => {
  const table = TABLE_NAMES.fxTransferDuplicateCheck
  const queryName = `${table}_saveFxTransferDuplicateCheck`
  return saveCommitRequestIdAndHash({ commitRequestId, hash, table, queryName })
}

/**
 * @function getFxTransferErrorDuplicateCheck
 *
 * @async
 * @description This retrieves the fxTransferErrorDuplicateCheck table record if present
 *
 * @param {string} commitRequestId - the fxTransfer commitRequestId
 *
 * @returns {object} - Returns the record from fxTransferDuplicateCheck table, or throws an error if failed
 */
const getFxTransferErrorDuplicateCheck = async (commitRequestId) => {
  const table = TABLE_NAMES.fxTransferErrorDuplicateCheck
  const queryName = `${table}_getFxTransferErrorDuplicateCheck`
  return getOneByCommitRequestId({ commitRequestId, table, queryName })
}

/**
 * @function saveFxTransferErrorDuplicateCheck
 *
 * @async
 * @description This inserts a record into fxTransferErrorDuplicateCheck table
 *
 * @param {string} commitRequestId - the fxTransfer commitRequestId
 * @param {string} hash - the hash of the fxTransfer request payload
 *
 * @returns {integer} - Returns the database id of the inserted row, or throws an error if failed
 */
const saveFxTransferErrorDuplicateCheck = async (commitRequestId, hash) => {
  const table = TABLE_NAMES.fxTransferErrorDuplicateCheck
  const queryName = `${table}_saveFxTransferErrorDuplicateCheck`
  return saveCommitRequestIdAndHash({ commitRequestId, hash, table, queryName })
}

/**
 * @function getFxTransferFulfilmentDuplicateCheck
 *
 * @async
 * @description This retrieves the fxTransferFulfilmentDuplicateCheck table record if present
 *
 * @param {string} commitRequestId - the fxTransfer commitRequestId
 *
 * @returns {object} - Returns the record from fxTransferFulfilmentDuplicateCheck table, or throws an error if failed
 */
const getFxTransferFulfilmentDuplicateCheck = async (commitRequestId) => {
  const table = TABLE_NAMES.fxTransferFulfilmentDuplicateCheck
  const queryName = `${table}_getFxTransferFulfilmentDuplicateCheck`
  return getOneByCommitRequestId({ commitRequestId, table, queryName })
}

/**
 * @function saveFxTransferFulfilmentDuplicateCheck
 *
 * @async
 * @description This inserts a record into fxTransferFulfilmentDuplicateCheck table
 *
 * @param {string} commitRequestId - the fxTransfer commitRequestId
 * @param {string} hash - the hash of the fxTransfer request payload
 *
 * @returns {integer} - Returns the database id of the inserted row, or throws an error if failed
 */
const saveFxTransferFulfilmentDuplicateCheck = async (commitRequestId, hash) => {
  const table = TABLE_NAMES.fxTransferFulfilmentDuplicateCheck
  const queryName = `${table}_saveFxTransferFulfilmentDuplicateCheck`
  return saveCommitRequestIdAndHash({ commitRequestId, hash, table, queryName })
}

module.exports = {
  getFxTransferDuplicateCheck,
  saveFxTransferDuplicateCheck,

  getFxTransferErrorDuplicateCheck,
  saveFxTransferErrorDuplicateCheck,

  getFxTransferFulfilmentDuplicateCheck,
  saveFxTransferFulfilmentDuplicateCheck
}
