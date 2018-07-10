'use strict'

const P = require('bluebird')
const TransferModel = require('../../models/transfer/transfer')
const TransferFacade = require('../../models/transfer/facade')
const SettlementFacade = require('../../models/settlement/facade')
const SettlementModel = require('../../models/settlement/settlement')
const Projection = require('./projection')
const TransferObjectTransform = require('./transform')
const Enum = require('../../lib/enum')
const Events = require('../../lib/events')
const Errors = require('../../errors')

const getTransferById = (id) => {
  return TransferModel.getById(id)
}

const getById = (id) => {
  return TransferFacade.getById(id)
}

const getAll = () => {
  return TransferFacade.getAll()
}

const getFulfillment = (id) => {
  return getById(id)
    .then(transfer => {
      if (!transfer) {
        throw new Errors.TransferNotFoundError()
      }
      if (!transfer.executionCondition) {
        throw new Errors.TransferNotConditionalError()
      }
      if (transfer.state === Enum.TransferState.REJECTED) {
        throw new Errors.AlreadyRolledBackError()
      }
      if (!transfer.fulfilment) {
        throw new Errors.MissingFulfillmentError()
      }
      return transfer.fulfilment
    })
}

const prepare = async (payload, stateReason = null, hasPassedValidation = true) => {
  try {
    const result = await Projection.saveTransferPrepared(payload, stateReason, hasPassedValidation)
    const t = TransferObjectTransform.toTransfer(result)
    Events.emitTransferPrepared(t)
    return {transfer: t}
  } catch (e) {
    throw e
  }
}

const reject = async (stateReason, transferId) => {
  const {alreadyRejected, transferStateChange} = await Projection.saveTransferRejected(stateReason, transferId)
  // const t = TransferObjectTransform.toTransfer(result)
  if (!alreadyRejected) {
    Events.emitTransferRejected(transferStateChange)
  }
  return {alreadyRejected, transferStateChange}
}

const expire = (id) => {
  return reject({id, rejection_reason: Enum.RejectionType.EXPIRED})
}

const fulfil = (transferId, fulfilment) => {
  return Projection.saveTransferExecuted(transferId, fulfilment)
    .then(transfer => {
      const t = TransferObjectTransform.toTransfer(transfer)
      Events.emitTransferExecuted(t, {execution_condition_fulfillment: fulfilment.fulfilment})
      return t
    })
    .catch(err => {
      if (typeof err === Errors.ExpiredTransferError) {
        return expire(fulfilment.id)
          .then(() => { throw new Errors.UnpreparedTransferError() })
      } else {
        throw err
      }
    })
}

const rejectExpired = () => {
  // TODO: create/recover findExpired method
  // const rejections = TransferFacade.findExpired().then(expired => expired.map(x => expire(x.transferId)))
  // return P.all(rejections).then(rejections => {
  //   return rejections.map(r => r.transfer.id)
  // })
}

const settle = async () => {
  const settlementId = SettlementModel.generateId()
  const settledTransfers = SettlementModel.create(settlementId, 'transfer').then(() => {
    return SettlementFacade.getSettleableTransfers().then(transfers => {
      transfers.forEach(transfer => {
        Projection.saveSettledTransfers({id: transfer.transferId, settlement_id: settlementId})
      })
      return transfers
    })
  })

  return P.all(settledTransfers).then(settledTransfers => {
    if (settledTransfers.length > 0) {
      return settledTransfers
    } else {
      return P.resolve([])
    }
  })
}

module.exports = {
  fulfil,
  getTransferById,
  getById,
  getAll,
  getFulfillment,
  prepare,
  reject,
  rejectExpired,
  settle
}

