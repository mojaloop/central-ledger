'use strict'

const P = require('bluebird')
const TransferFacade = require('../../models/transfer/facade')
const TransferModel = require('../../models/transfer/transfer')
const TransferStateChangeModel = require('../../models/transfer/transferStateChange')
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

const getTransferState = (id) => {
  return TransferStateChangeModel.getByTransferId(id)
}

const getTransferInfoToChangePosition = (id, transferParticipantRoleTypeId, ledgerEntryTypeId) => {
  return TransferFacade.getTransferInfoToChangePosition(id, transferParticipantRoleTypeId, ledgerEntryTypeId)
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

const expire = (id) => {
  return reject({id, rejection_reason: Enum.RejectionType.EXPIRED})
}

const fulfil = async (transferId, payload) => {
  try {
    const isCommit = true
    const transfer = await TransferFacade.saveTransferFulfiled(transferId, payload, isCommit)
    return TransferObjectTransform.toTransfer(transfer)
  } catch (err) {
    if (typeof err === Errors.ExpiredTransferError) {
      await expire(payload.id)
      throw new Errors.UnpreparedTransferError()
    } else {
      throw err
    }
  }
}

const reject = async (transferId, payload) => {
  try {
    const isCommit = false
    const stateReason = 'Transaction failed due to user rejection' // TODO: move to generic reason
    const transfer = await TransferFacade.saveTransferFulfiled(transferId, payload, isCommit, stateReason)
    return TransferObjectTransform.toTransfer(transfer)
  } catch (err) {
    if (typeof err === Errors.ExpiredTransferError) {
      await expire(payload.id)
      throw new Errors.UnpreparedTransferError()
    } else {
      throw err
    }
  }
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

const saveTransferStateChange = async (stateRecord) => {
  TransferStateChangeModel.saveTransferStateChange(stateRecord)
}

module.exports = {
  getTransferById,
  getById,
  getAll,
  getTransferState,
  getTransferInfoToChangePosition,
  getFulfillment,
  prepare,
  fulfil,
  reject,
  rejectExpired,
  settle,
  saveTransferStateChange
}

