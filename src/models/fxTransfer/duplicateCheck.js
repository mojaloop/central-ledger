const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Metrics = require('@mojaloop/central-services-metrics')
const Db = require('../../lib/db')
const { logger } = require('../../shared/logger')
const { TABLE_NAMES } = require('../../shared/constants')

const histName = 'model_fx_transfer'

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
  const histTimerEnd = Metrics.getHistogram(
    histName,
    `${queryName} - Metrics for fxTransfer duplicate check model`,
    ['success', 'queryName']
  ).startTimer()
  logger.debug(`get ${table}`, { commitRequestId })

  try {
    const result = await Db.from(table).findOne({ commitRequestId })
    histTimerEnd({ success: true, queryName })
    return result
  } catch (err) {
    histTimerEnd({ success: false, queryName })
    throw new Error(err?.message)
  }
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
  const histTimerEnd = Metrics.getHistogram(
    histName,
    `${queryName} - Metrics for fxTransfer duplicate check model`,
    ['success', 'queryName']
  ).startTimer()
  logger.debug(`save ${table}`, { commitRequestId, hash })

  try {
    const result = await Db.from(table).insert({ commitRequestId, hash })
    histTimerEnd({ success: true, queryName })
    return result
  } catch (err) {
    histTimerEnd({ success: false, queryName })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
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
  const histTimerEnd = Metrics.getHistogram(
    histName,
    `${queryName} - Metrics for fxTransfer error duplicate check model`,
    ['success', 'queryName']
  ).startTimer()
  logger.debug(`get ${table}`, { commitRequestId })

  try {
    const result = await Db.from(table).findOne({ commitRequestId })
    histTimerEnd({ success: true, queryName })
    return result
  } catch (err) {
    histTimerEnd({ success: false, queryName })
    throw new Error(err?.message)
  }
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
  const histTimerEnd = Metrics.getHistogram(
    histName,
    `${queryName} - Metrics for fxTransfer error duplicate check model`,
    ['success', 'queryName']
  ).startTimer()
  logger.debug(`save ${table}`, { commitRequestId, hash })

  try {
    const result = await Db.from(table).insert({ commitRequestId, hash })
    histTimerEnd({ success: true, queryName })
    return result
  } catch (err) {
    histTimerEnd({ success: false, queryName })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  getFxTransferDuplicateCheck,
  saveFxTransferDuplicateCheck,

  getFxTransferErrorDuplicateCheck,
  saveFxTransferErrorDuplicateCheck
}
