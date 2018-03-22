'use strict'

const P = require('bluebird')
const TransferQueries = require('./queries')
const SettleableTransfersReadModel = require('../../models/settleable-transfers-read-model')
const SettlementsModel = require('../../models/settlements')
const Commands = require('./commands')
const Translator = require('./translator')
const RejectionType = require('./rejection-type')
const State = require('./state')
const Events = require('../../lib/events')
const Errors = require('../../errors')
const Logger = require('@mojaloop/central-services-shared').Logger

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
      if (!transfer.fulfillment) {
        throw new Errors.MissingFulfillmentError()
      }
      return transfer.fulfillment
    })
}

const prepare = (payload) => {
  const transfer = Translator.fromPayload(payload)
  return Commands.prepare(transfer)
    .then(result => {
      Logger.info('prepare result')
      Logger.info(JSON.stringify(result))
      const t = Translator.toTransfer(result)
      Logger.info('translate completed')
      Events.emitTransferPrepared(t)
      Logger.info('emit completed')
      return {existing: result.existing, transfer: t}
    }).catch(err => {
      throw err
    })
}

const reject = (rejection) => {
  return Commands.reject(rejection)
    .then(({alreadyRejected, transfer}) => {
      const t = Translator.toTransfer(transfer)
      Logger.info('transfer index.jz : Const reject ')
      if (!alreadyRejected) {
        Logger.info('transfer index.jz : if (!alreadyRejected) ')
        Events.emitTransferRejected(t)
      }
      return {alreadyRejected, transfer: t}
    })
}

const expire = (id) => {
  return reject({id, rejection_reason: RejectionType.EXPIRED})
}

const fulfill = (fulfillment) => {
  Logger.info('transfer index.jz : const fulfill ')
  return Commands.fulfill(fulfillment)
    .then(transfer => {
      Logger.info('prepare result')
      Logger.info(JSON.stringify(transfer))
      Logger.info('transfer index.jz : .then(transfer => ')
      const t = Translator.toTransfer(transfer)
      Events.emitTransferExecuted(t, {execution_condition_fulfillment: fulfillment.fulfillment})
      return t
    })
    .catch(err => {
      if (typeof err === Errors.ExpiredTransferError) {
        return expire(fulfillment.id)
          .then(() => { throw new Errors.UnpreparedTransferError() })
      } else {
        throw new Error(err)
      }
    })
}

const rejectExpired = () => {
  const rejections = TransferQueries.findExpired().then(expired => expired.map(x => expire(x.transferUuid)))
  return P.all(rejections).then(rejections => {
    return rejections.map(r => r.transfer.id)
  })
}

const settle = () => {
  Logger.info('transfer index.jz : const settle = () ')
  const settlementId = SettlementsModel.generateId()
  const settledTransfers = SettlementsModel.create(settlementId, 'transfer').then(() => {
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
  fulfill,
  getById,
  getAll,
  getFulfillment,
  prepare,
  reject,
  rejectExpired,
  settle
}

