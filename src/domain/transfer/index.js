'use strict'

const P = require('bluebird')
const TransferQueries = require('./queries')
const SettleableTransfersReadModel = require('../../models/settleable-transfers-read-model')
const SettlementModel = require('../../models/settlement')
const Commands = require('./commands')
const Translator = require('./translator')
const RejectionType = require('./rejection-type')
const State = require('./state')
const Events = require('../../lib/events')
const Errors = require('../../errors')

const getById = (id) => {
  return TransferQueries.getById(id)
}

const getAll = () => {
  return TransferQueries.getAll()
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
      if (transfer.state === State.REJECTED) {
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
    const result = await Commands.prepare(payload, stateReason, hasPassedValidation)
    const t = Translator.toTransfer(result)
    Events.emitTransferPrepared(t)
    return {transfer: t}
  } catch (e) {
    throw e
  }
}

const reject = async (stateReason, transferId) => {
  const {alreadyRejected, transferStateChange} = await Commands.reject(stateReason, transferId)
  // const t = Translator.toTransfer(result)
  if (!alreadyRejected) {
    Events.emitTransferRejected(transferStateChange)
  }
  return {alreadyRejected, transferStateChange}
}

const expire = (id) => {
  return reject({id, rejection_reason: RejectionType.EXPIRED})
}

const fulfil = (fulfilment) => {
  return Commands.fulfil(fulfilment)
    .then(transfer => {
      const t = Translator.toTransfer(transfer)
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
  const rejections = TransferQueries.findExpired().then(expired => expired.map(x => expire(x.transferId)))
  return P.all(rejections).then(rejections => {
    return rejections.map(r => r.transfer.id)
  })
}

const settle = async () => {
  const settlementId = SettlementModel.generateId()
  const settledTransfers = SettlementModel.create(settlementId, 'transfer').then(() => {
    return SettleableTransfersReadModel.getSettleableTransfers().then(transfers => {
      transfers.forEach(transfer => {
        Commands.settle({id: transfer.transferId, settlement_id: settlementId})
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
  getById,
  getAll,
  getFulfillment,
  prepare,
  reject,
  rejectExpired,
  settle
}

