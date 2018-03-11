'use strict'

const Uuid = require('uuid4')
const Moment = require('moment')

const hostname = 'central-ledger'
const executionCondition = 'ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0'

const generateTransferId = () => {
  return Uuid()
}

const generateAccountName = () => {
  return generateRandomName()
}

const generateRandomName = () => {
  return `dfsp${Uuid().replace(/-/g, '')}`.substr(0, 25)
}

const buildDebitOrCredit = (accountName, amount, memo) => {
  return {
    account: `http://${hostname}/accounts/${accountName}`,
    amount: amount,
    memo: memo,
    authorized: true
  }
}

const futureDate = () => {
  let d = new Date()
  d.setTime(d.getTime() + 86400000)
  return d
}

const buildTransfer = (transferId, debit, credit, expiresAt) => {
  expiresAt = (expiresAt || futureDate()).toISOString()
  return {
    id: `http://${hostname}/transfers/${transferId}`,
    ledger: `http://${hostname}`,
    debits: [debit],
    credits: [credit],
    execution_condition: executionCondition,
    expires_at: expiresAt
  }
}

const buildUnconditionalTransfer = (transferId, debit, credit) => {
  return {
    id: `http://${hostname}/transfers/${transferId}`,
    ledger: `http://${hostname}`,
    debits: [debit],
    credits: [credit]
  }
}

const buildTransferPreparedEvent = (transferId, debit, credit, expiresAt) => {
  expiresAt = (expiresAt || futureDate()).toISOString()
  return {
    id: 1,
    name: 'TransferPrepared',
    payload: {
      ledger: `${hostname}`,
      debits: [debit],
      credits: [credit],
      execution_condition: executionCondition,
      expires_at: expiresAt
    },
    aggregate: {
      id: transferId,
      name: 'Transfer'
    },
    context: 'Ledger',
    timestamp: 1474471273588
  }
}

const buildTransferExecutedEvent = (transferId, debit, credit, expiresAt) => {
  expiresAt = (expiresAt || futureDate()).toISOString()
  return {
    id: 2,
    name: 'TransferExecuted',
    payload: {
      ledger: `${hostname}`,
      debits: [debit],
      credits: [credit],
      execution_condition: executionCondition,
      expires_at: expiresAt,
      fulfillment: 'oAKAAA'
    },
    aggregate: {
      id: transferId,
      name: 'Transfer'
    },
    context: 'Ledger',
    timestamp: 1474471284081
  }
}

const buildTransferRejectedEvent = (transferId, rejectionReason) => {
  return {
    id: 2,
    name: 'TransferRejected',
    payload: {
      rejection_reason: rejectionReason
    },
    aggregate: {
      id: transferId,
      name: 'Transfer'
    },
    context: 'Ledger',
    timestamp: 1474471286000
  }
}

const buildReadModelTransfer = (transferId, debit, credit, state, expiresAt, preparedDate, rejectionReason) => {
  state = state || 'prepared'
  expiresAt = (expiresAt || futureDate()).toISOString()
  preparedDate = (preparedDate || new Date()).toISOString()
  return {
    transferUuid: transferId,
    state: state,
    ledger: `${hostname}`,
    debitAccountId: debit.accountId,
    debitAmount: debit.amount,
    debitMemo: debit.memo,
    creditAccountId: credit.accountId,
    creditAmount: credit.amount,
    creditMemo: credit.memo,
    executionCondition: executionCondition,
    rejectionReason: rejectionReason,
    expiresAt: expiresAt,
    preparedDate: preparedDate
  }
}

const buildCharge = (name, rateType, code) => {
  return {
    'name': name,
    'charge_type': 'fee',
    'rate_type': rateType,
    'rate': '0.50',
    'code': code,
    'minimum': '16.00',
    'maximum': '100.00',
    'is_active': true,
    'payer': 'sender',
    'payee': 'receiver'
  }
}

const findAccountPositions = (positions, accountName) => {
  return positions.find(function (p) {
    return p.account === buildAccountUrl(accountName)
  })
}

const buildAccountUrl = (accountName) => {
  return `http://${hostname}/accounts/${accountName}`
}

function buildAccountPosition (accountName, tPayments, tReceipts, fPayments, fReceipts) {
  return {
    account: buildAccountUrl(accountName),
    fees: {
      payments: fPayments.toString(),
      receipts: fReceipts.toString(),
      net: (fReceipts - fPayments).toString()
    },
    transfers: {
      payments: tPayments.toString(),
      receipts: tReceipts.toString(),
      net: (tReceipts - tPayments).toString()
    },
    net: (tReceipts - tPayments + fReceipts - fPayments).toString()
  }
}

const getMomentToExpire = (timeToPrepareTransfer = 0.5) => {
  return Moment.utc().add(timeToPrepareTransfer, 'seconds')
}

const getCurrentUTCTimeInMilliseconds = () => {
  return new Date().getTime()
}

const rejectionMessage = () => {
  return {
    code: 'S00',
    name: 'Bad Request',
    message: 'destination transfer failed',
    triggered_by: 'example.red.bob',
    additional_info: {}
  }
}

module.exports = {
  hostname,
  buildAccountPosition,
  buildCharge,
  buildDebitOrCredit,
  buildTransfer,
  buildUnconditionalTransfer,
  buildTransferPreparedEvent,
  buildTransferExecutedEvent,
  buildTransferRejectedEvent,
  buildReadModelTransfer,
  findAccountPositions,
  generateRandomName,
  generateAccountName,
  generateTransferId,
  getMomentToExpire,
  getCurrentUTCTimeInMilliseconds,
  rejectionMessage
}
