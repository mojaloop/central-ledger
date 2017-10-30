'use strict'

const Db = require('../db')

exports.getSettleableTransfers = () => {
  return Db.executedTransfers.query(buildSettleableTransfersQuery)
}

exports.getUnsettledTransfers = () => {
  return Db.executedTransfers.query(buildUnsetttledTransfersQuery)
}

exports.getUnsettledTransfersByAccount = (accountId) => {
  return Db.executedTransfers.query(builder => {
    return buildUnsetttledTransfersQuery(builder).andWhere(q => q.where('t.creditAccountId', accountId).orWhere('t.debitAccountId', accountId))
  })
}

const buildSettleableTransfersQuery = (builder) => {
  return builder
    .leftJoin('settledTransfers AS st', 'executedTransfers.transferId', 'st.transferId')
    .innerJoin('transfers AS t', 'executedTransfers.transferId', 't.transferUuid')
    .innerJoin('accounts AS ca', 't.creditAccountId', 'ca.accountId')
    .innerJoin('accounts AS da', 't.debitAccountId', 'da.accountId')
    .innerJoin('accountsSettlement AS ss', 't.debitAccountId', 'ss.accountId')
    .innerJoin('accountsSettlement AS sd', 't.creditAccountId', 'sd.accountId')
    .whereNull('st.transferId')
    .distinct('executedTransfers.transferId AS transferId', 'ca.name AS creditAccountName', 'da.name AS debitAccountName', 't.creditAmount AS creditAmount', 't.debitAmount AS debitAmount', 'ss.accountNumber AS sourceAccountNumber', 'ss.routingNumber AS sourceRoutingNumber', 'sd.accountNumber AS destinationAccountNumber', 'sd.routingNumber AS destinationRoutingNumber')
}

const buildUnsetttledTransfersQuery = (builder) => {
  return builder
    .leftJoin('settledTransfers AS st', 'executedTransfers.transferId', 'st.transferId')
    .innerJoin('transfers AS t', 'executedTransfers.transferId', 't.transferUuid')
    .innerJoin('accounts AS ca', 't.creditAccountId', 'ca.accountId')
    .innerJoin('accounts AS da', 't.debitAccountId', 'da.accountId')
    .whereNull('st.transferId')
    .distinct('executedTransfers.transferId AS transferId', 'ca.name AS creditAccountName', 'da.name AS debitAccountName', 't.creditAmount AS creditAmount', 't.debitAmount AS debitAmount')
}
