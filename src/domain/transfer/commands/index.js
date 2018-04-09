'use strict'

const Projection = require('../../../domain/transfer/projection')
const FeeProjection = require('../../../domain/fee/index')
const Query = require('../../../domain/transfer/queries')
const State = require('../state')
const CryptoConditions = require('../../../crypto-conditions')
const Errors = require('../../../errors')

const prepare = async (transfer) => {
  transfer.timeline = {
    prepared_at: new Date()
  }
  return await Projection.saveTransferPrepared(transfer).catch(err => {
    throw err
  })
}

const fulfill = async (fulfillment) => {
  const record = {
    payload: fulfillment,
    timestamp: new Date()
  }
  const transfer = await Query.getById(fulfillment.id)
  if (!transfer.executionCondition) {
    throw new Errors.TransferNotConditionalError()
  }
  if ((transfer.state === State.EXECUTED || transfer.state === State.SETTLED) && fulfillment === fulfillment.fulfillment) {
    return transfer
  }
  if (new Date() > new Date(transfer.expiresAt)) {
    throw new Errors.ExpiredTransferError()
  }
  if (transfer.state !== State.PREPARED) {
    throw new Errors.InvalidModificationError(`Transfers in state ${transfer.state} may not be executed`)
  }
  CryptoConditions.validateFulfillment(fulfillment.fulfillment, transfer.executionCondition)
  await Projection.saveTransferExecuted({payload: record.payload, timestamp: record.timestamp})
  await Projection.saveExecutedTransfer(record)
  const fulfilledTransfer = await Query.getById(fulfillment.id)
  await FeeProjection.generateFeesForTransfer(fulfilledTransfer)
  return fulfilledTransfer
}

const reject = async (rejection) => {
  const record = {
    aggregate: {
      id: rejection.id
    },
    payload: rejection,
    timestamp: new Date()
  }
  const transfer = await Query.getById(rejection.id)
  if (transfer.state === State.REJECTED && transfer.rejectionReason === rejection.message) {
    return {alreadyRejected: true, transfer}
  }
  if (!transfer.state === State.PREPARED) {
    throw new Errors.InvalidModificationError(`Transfers in state ${transfer.state} may not be rejected`)
  }
  await Projection.saveTransferRejected(record)
  const updatedTransfer = await Query.getById(rejection.id)
  return {alreadyRejected: false, transfer: updatedTransfer}
}

const settle = ({id, settlement_id}) => {
  return Projection.saveSettledTransfers({id, settlement_id})
}

module.exports = {
  fulfill,
  prepare,
  reject,
  settle
}
