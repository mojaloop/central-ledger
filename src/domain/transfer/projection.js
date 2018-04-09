'use strict'

const _ = require('lodash')
const UrlParser = require('../../lib/urlparser')
const Util = require('../../lib/util')
const AccountService = require('../../domain/account')
const TransferState = require('./state')
const TransferRejectionType = require('./rejection-type')
const TransfersReadModel = require('./models/transfers-read-model')
const ExecuteTransfersModel = require('../../models/executed-transfers')
const SettledTransfersModel = require('../../models/settled-transfers')

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
  await TransfersReadModel.saveTransfer(record).catch(err => {
    throw new Error(err.message)
  })
  record.creditAccountName = creditAccount
  record.debitAccountName = debitAccount
  return record
}

const saveTransferExecuted = async ({payload, timestamp}) => {
  const fields = {
    state: TransferState.EXECUTED,
    fulfillment: payload.fulfillment,
    executedDate: new Date(timestamp)
  }
  return await TransfersReadModel.updateTransfer(payload.id, fields)
}

const saveTransferRejected = async ({aggregate, payload, timestamp}) => {
  const fields = {
    state: TransferState.REJECTED,
    rejectionReason: payload.rejection_reason,
    rejectedDate: new Date(timestamp)
  }
  if (payload.rejection_reason === TransferRejectionType.CANCELLED) {
    Util.assign(fields, {
      creditRejected: 1,
      creditRejectionMessage: payload.message || ''
    })
  }
  return await TransfersReadModel.updateTransfer(aggregate.id, fields)
}

const saveExecutedTransfer = async (transfer) => {
  await ExecuteTransfersModel.create(transfer.payload.id)
}

const saveSettledTransfers = async ({id, settlement_id}) => {
  await SettledTransfersModel.create({id, settlement_id})
}

module.exports = {
  saveTransferPrepared,
  saveTransferExecuted,
  saveTransferRejected,
  saveExecutedTransfer,
  saveSettledTransfers
}
