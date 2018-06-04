'use strict'

const Projection = require('../../../domain/transfer/projection')

const prepare = async (transfer, stateReason = null, hasPassedValidation = true) => {
  try {
    return await Projection.saveTransferPrepared(transfer, stateReason, hasPassedValidation)
  } catch (error) {
    throw error
  }
}

const reject = async (stateReason, transferId) => {
  try {
    return await Projection.saveTransferRejected(stateReason, transferId)
  } catch (error) {
    throw error
  }
}

const settle = ({id, settlement_id}) => {
  return Projection.saveSettledTransfers({id, settlement_id})
}

module.exports = {
  prepare,
  reject,
  settle
}
