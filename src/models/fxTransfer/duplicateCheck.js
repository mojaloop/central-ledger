const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Metrics = require('@mojaloop/central-services-metrics')
const Db = require('../../lib/db')
const { logger } = require('../../shared/logger')
const { TABLE_NAMES } = require('../../shared/constants')

const table = TABLE_NAMES.fxTransferDuplicateCheck

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
  const queryName = `${table}_getFxTransferDuplicateCheck`
  const histTimerEnd = Metrics.getHistogram(
    'model_transfer',
    `${queryName} - Metrics for fxTransfer duplicate check model`,
    ['success', 'queryName']
  ).startTimer()
  logger.debug(`get ${table}`, { commitRequestId })

  try {
    const result = Db.from(table).findOne({ commitRequestId })
    histTimerEnd({ success: true, queryName })
    return result
  } catch (err) {
    histTimerEnd({ success: false, queryName })
    throw new Error(err.message)
  }
}

/**
 * @function SaveTransferDuplicateCheck
 *
 * @async
 * @description This inserts a record into transferDuplicateCheck table
 *
 * @param {string} commitRequestId - the fxTtransfer commitRequestId
 * @param {string} hash - the hash of the transfer request payload
 *
 * @returns {integer} - Returns the database id of the inserted row, or throws an error if failed
 */

const saveFxTransferDuplicateCheck = async (commitRequestId, hash) => {
  const queryName = `${table}_saveFxTransferDuplicateCheck`
  const histTimerEnd = Metrics.getHistogram(
    'model_transfer',
    `${queryName} - Metrics for fxTransfer duplicate check model`,
    ['success', 'queryName']
  ).startTimer()
  logger.debug(`save ${table}`, { commitRequestId, hash })

  try {
    const result = Db.from(table).insert({ commitRequestId, hash })
    histTimerEnd({ success: true, queryName })
    return result
  } catch (err) {
    histTimerEnd({ success: false, queryName })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  getFxTransferDuplicateCheck,
  saveFxTransferDuplicateCheck
}
