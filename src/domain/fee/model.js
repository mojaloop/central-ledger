'use strict'

const Db = require('../../db')

exports.create = (fee) => {
  return Db.fees.insert(fee)
}

exports.getAllForTransfer = (transfer) => {
  return Db.fees.find({ transferId: transfer.transferUuid })
}

exports.getSettleableFeesForTransfer = (transfer) => {
  return Db.fees.query(builder => {
    return buildSettleableFeesQuery(builder).where('fees.transferId', transfer.transferId)
  })
}

exports.doesExist = (charge, transfer) => {
  return Db.fees.findOne({ transferId: transfer.transferUuid, chargeId: charge.chargeId })
}

exports.getUnsettledFees = () => {
  return Db.fees.query(buildUnsettledFeesQuery)
}

exports.getUnsettledFeesByAccount = (account) => {
  return Db.fees.query(builder => {
    return buildUnsettledFeesQuery(builder).andWhere(q => q.where('fees.payerAccountId', account.accountId).orWhere('fees.payeeAccountId', account.accountId))
  })
}

const buildSettleableFeesQuery = (builder) => {
  return builder
    .leftJoin('settledFees AS sf', 'fees.feeId', 'sf.feeId')
    .innerJoin('accounts AS pe', 'fees.payeeAccountId', 'pe.accountId')
    .innerJoin('accounts AS pr', 'fees.payerAccountId', 'pr.accountId')
    .innerJoin('accountsSettlement AS ss', 'fees.payerAccountId', 'ss.accountId')
    .innerJoin('accountsSettlement AS sd', 'fees.payeeAccountId', 'sd.accountId')
    .whereNull('sf.feeId')
    .distinct('fees.feeId AS feeId', 'pe.name AS payeeAccountName', 'pr.name AS payerAccountName', 'fees.amount AS payeeAmount', 'fees.amount AS payerAmount', 'ss.accountNumber AS sourceAccountNumber', 'ss.routingNumber AS sourceRoutingNumber', 'sd.accountNumber AS destinationAccountNumber', 'sd.routingNumber AS destinationRoutingNumber')
}

const buildUnsettledFeesQuery = (builder) => {
  return builder
    .leftJoin('settledFees AS sf', 'fees.feeId', 'sf.feeId')
    .innerJoin('accounts AS pe', 'fees.payeeAccountId', 'pe.accountId')
    .innerJoin('accounts AS pr', 'fees.payerAccountId', 'pr.accountId')
    .whereNull('sf.feeId')
    .distinct('fees.feeId AS feeId', 'pe.name AS payeeAccountName', 'pr.name AS payerAccountName', 'fees.amount AS payeeAmount', 'fees.amount AS payerAmount')
}
