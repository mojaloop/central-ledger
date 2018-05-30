'use strict'

const Projection = require('../../../domain/transfer/projection')
const FeeProjection = require('../../../domain/fee/index')
const Query = require('../../../domain/transfer/queries')
// const State = require('../state')
const CryptoConditions = require('../../../crypto-conditions')
const Errors = require('../../../errors')

const prepare = async (transfer, stateReason = null, hasPassedValidation = true) => {
  try {
    return await Projection.saveTransferPrepared(transfer, stateReason, hasPassedValidation)
  } catch (error) {
    throw error
  }
}

const fulfil = async (fulfilment) => {
  const record = {
    payload: fulfilment,
    timestamp: new Date()
  }
  const transfer = await Query.getById(fulfilment.id)
  if (!transfer.executionCondition) {
    throw new Errors.TransferNotConditionalError()
  }
  // if ((transfer.state === State.EXECUTED || transfer.state === State.SETTLED) && fulfilment === fulfilment.fulfilment) {
  //   return transfer
  // }
  if (new Date() > new Date(transfer.expirationDate)) {
    throw new Errors.ExpiredTransferError()
  }
  // if (transfer.state !== State.PREPARED) {
  //   throw new Errors.InvalidModificationError(`Transfers in state ${transfer.state} may not be executed`)
  // }
  CryptoConditions.validateFulfillment(fulfilment.fulfilment, transfer.executionCondition)
  await Projection.saveTransferExecuted({payload: record.payload, timestamp: record.timestamp})
  await Projection.saveExecutedTransfer(record)
  const fulfilledTransfer = await Query.getById(fulfilment.id)
  await FeeProjection.generateFeeForTransfer(fulfilledTransfer)
  return fulfilledTransfer
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
  fulfil,
  prepare,
  reject,
  settle
}
