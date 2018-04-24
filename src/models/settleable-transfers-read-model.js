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
    return buildUnsetttledTransfersQuery(builder).andWhere(q => q.where('t.payerParticipantId', accountId).orWhere('t.payeeParticipantId', accountId))
  })
}

const buildSettleableTransfersQuery = (builder) => {
  return builder
    .leftJoin('settledTransfers AS st', 'executedTransfers.transferId', 'st.transferId')
    .innerJoin('transfer AS t', 'executedTransfers.transferId', 't.transferId')
    .innerJoin('accounts AS ca', 't.payerParticipantId', 'ca.accountId')
    .innerJoin('accounts AS da', 't.payeeParticipantId', 'da.accountId')
    .innerJoin('accountsSettlement AS ss', 't.payeeParticipantId', 'ss.accountId')
    .innerJoin('accountsSettlement AS sd', 't.payerParticipantId', 'sd.accountId')
    .whereNull('st.transferId')
    .distinct('executedTransfers.transferId AS transferId', 'ca.name AS creditAccountName', 'da.name AS debitAccountName', 't.payerAmount AS payerAmount', 't.payeeAmount AS payeeAmount', 'ss.accountNumber AS sourceAccountNumber', 'ss.routingNumber AS sourceRoutingNumber', 'sd.accountNumber AS destinationAccountNumber', 'sd.routingNumber AS destinationRoutingNumber')
}

const buildUnsetttledTransfersQuery = (builder) => {
  return builder
    .leftJoin('settledTransfers AS st', 'executedTransfers.transferId', 'st.transferId')
    .innerJoin('transfer AS t', 'executedTransfers.transferId', 't.transferId')
    .innerJoin('accounts AS ca', 't.payerParticipantId', 'ca.accountId')
    .innerJoin('accounts AS da', 't.payeeParticipantId', 'da.accountId')
    .whereNull('st.transferId')
    .distinct('executedTransfers.transferId AS transferId', 'ca.name AS creditAccountName', 'da.name AS debitAccountName', 't.payerAmount AS payerAmount', 't.payeeAmount AS payeeAmount')
}
