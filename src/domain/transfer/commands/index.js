'use strict'

/**
 * @module src/domain/transfer/commands
 */

const Projection = require('../../../domain/transfer/projection')

/**
 * @function prepare
 * @async
 * @description This is the transfer prepare function, that inserts the transfer into the database with the correct set of parameters.
 * @param  {object} transfer the transfer object that is being prepared
 * @param  {string} stateReason=null the reason for the transfer state
 * @param  {boolean} hasPassedValidation=true flag for passed validation
 * @returns {string} id of the inserted transfer
 */

const prepare = async (transfer, stateReason = null, hasPassedValidation = true) => {
  try {
    return await Projection.saveTransferPrepared(transfer, stateReason, hasPassedValidation)
  } catch (error) {
    throw error
  }
}

/**
 * @function reject
 * @async
 * @description This is the transfer reject function, that updates the transfer as rejected into the database
 * @param  {string} transferId the transfer that will be rejected
 * @param  {string} stateReason the reason for the transfer state
 * @returns {rejectAnswer} answer of the reject operation
 */

/**
 * @typedef {Object} rejectAnswer
 * @property {boolean} alreadyRejected flag for status
 * @property {string} transferStateChange new state of the transfer
 */

const reject = async (stateReason, transferId) => {
  try {
    return await Projection.saveTransferRejected(stateReason, transferId)
  } catch (error) {
    throw error
  }
}

/**
 * @function settle
 * @async
 * @description This is the transfer settle function, that sets the transfer as settled
 * @param  {Object} transfer_settlement the settlement object
 * @param {string} transfer_settlement.id transfer id
 * @param {string} transfer_settlement.settlement_id settlement id
 * @returns {string} id of the saved transfer
 */

const settle = ({id, settlement_id}) => {
  return Projection.saveSettledTransfers({id, settlement_id})
}

module.exports = {
  prepare,
  reject,
  settle
}
