'use strict'

const _ = require('lodash')
const P = require('bluebird')
const Moment = require('moment')
const DA = require('deasync-promise')
const Logger = require('@mojaloop/central-services-shared').Logger
const UrlParser = require('../../lib/urlparser')
const Util = require('../../lib/util')
const AccountService = require('../../domain/account')
const TransferState = require('./state')
const TransferRejectionType = require('./rejection-type')
const TransfersReadModel = require('./models/transfers-read-model')

const saveTransferPrepared = async (payload) => {
  const debitAccount = await UrlParser.nameFromAccountUri(payload.debits[0].account)
  const creditAccount = await UrlParser.nameFromAccountUri(payload.credits[0].account)
  const names = [debitAccount, creditAccount]
  const accounts = []
  for (var i = 0, len = names.length; i < len; i++) {
    const account = await AccountService.getByName(names[i])
    accounts.push(account)
  }
  const accountIds = await _.reduce(accounts, (m, acct) => _.set(m, acct.name, acct.accountId), {})
  const record = {
    transferUuid: payload.id,
    state: TransferState.PREPARED,
    ledger: payload.ledger,
    debitAccountId: accountIds[debitAccount],
    debitAmount: payload.debits[0].amount,
    debitMemo: JSON.stringify(payload.debits[0].memo),
    creditAccountId: accountIds[creditAccount],
    creditAmount: payload.credits[0].amount,
    creditMemo: JSON.stringify(payload.credits[0].memo),
    creditRejected: 0,
    creditRejectionMessage: null,
    executionCondition: payload.execution_condition,
    cancellationCondition: payload.cancellation_condition,
    fulfillment: null,
    rejectionReason: payload.rejection_reason,
    expiresAt: new Date(payload.expires_at),
    additionalInfo: payload.additional_info,
    preparedDate: payload.timeline.prepared_at,
    executedDate: null,
    rejectedDate: null
  }
  return await TransfersReadModel.saveTransfer(record)
}

const saveTransferExecuted = ({ aggregate, payload, timestamp }) => {
  const fields = {
    state: TransferState.EXECUTED,
    fulfillment: payload.fulfillment,
    executedDate: Moment(timestamp)
  }
  return TransfersReadModel.updateTransfer(aggregate.id, fields)
}

const saveTransferRejected = ({ aggregate, payload, timestamp }) => {
  const fields = {
    state: TransferState.REJECTED,
    rejectionReason: payload.rejection_reason,
    rejectedDate: Moment(timestamp)
  }
  if (payload.rejection_reason === TransferRejectionType.CANCELLED) {
    Util.assign(fields, {
      creditRejected: 1,
      creditRejectionMessage: payload.message || ''
    })
  }
  return TransfersReadModel.updateTransfer(aggregate.id, fields)
}

const initialize = (params, done) => {
  return TransfersReadModel.truncateTransfers()
    .then(() => done())
    .catch(err => {
      Logger.error('Error truncating read model', err)
    })
}

const handleTransferPrepared = (event) => {
  return DA(saveTransferPrepared(event)
    .catch(err => {
      Logger.error('Error handling TransferPrepared event', err)
    }))
}

const handleTransferExecuted = (event) => {
  return DA(saveTransferExecuted(event)
    .catch(err => {
      Logger.error('Error handling TransferExecuted event', err)
    }))
}

const handleTransferRejected = (event) => {
  return DA(saveTransferRejected(event)
    .catch(err => {
      Logger.error('Error handling TransferRejected event', err)
    }))
}

module.exports = {
  initialize,
  handleTransferExecuted,
  handleTransferPrepared,
  handleTransferRejected,
  saveTransferPrepared
}
