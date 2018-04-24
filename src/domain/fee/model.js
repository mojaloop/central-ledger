'use strict'

const Db = require('../../db')

exports.create = (fee) => {
  return Db.fees.insert(fee)
}

exports.getAllForTransfer = (transfer) => {
  return Db.fees.find({ transferId: transfer.transferId })
}

exports.getSettleableFeesForTransfer = (transfer) => {
  return Db.fees.query(builder => {
    return buildSettleableFeesQuery(builder).where('fees.transferId', transfer.transferId)
  })
}

exports.doesExist = (charge, transfer) => {
  return Db.fees.findOne({ transferId: transfer.transferId, chargeId: charge.chargeId })
}

exports.getUnsettledFee = () => {
  return Db.fees.query(buildUnsettledFeeQuery)
}

exports.getUnsettledFeeByAccount = (account) => {
  return Db.fees.query(builder => {
    return buildUnsettledFeeQuery(builder).andWhere(q => q.where('fees.payerParticipantId', account.accountId).orWhere('fees.payeeParticipantId', account.accountId))
  })
}

const buildSettleableFeesQuery = (builder) => {
  return builder
    .leftJoin('settledFee AS sf', 'fees.feeId', 'sf.feeId')
    .innerJoin('accounts AS pe', 'fees.payeeParticipantId', 'pe.accountId')
    .innerJoin('accounts AS pr', 'fees.payerParticipantId', 'pr.accountId')
    .innerJoin('accountsSettlement AS ss', 'fees.payerParticipantId', 'ss.accountId')
    .innerJoin('accountsSettlement AS sd', 'fees.payeeParticipantId', 'sd.accountId')
    .whereNull('sf.feeId')
    .distinct('fees.feeId AS feeId', 'pe.name AS payeeAccountName', 'pr.name AS payerAccountName', 'fees.amount AS payeeAmount', 'fees.amount AS payerAmount', 'ss.accountNumber AS sourceAccountNumber', 'ss.routingNumber AS sourceRoutingNumber', 'sd.accountNumber AS destinationAccountNumber', 'sd.routingNumber AS destinationRoutingNumber')
}

const buildUnsettledFeeQuery = (builder) => {
  return builder
    .leftJoin('settledFee AS sf', 'fees.feeId', 'sf.feeId')
    .innerJoin('accounts AS pe', 'fees.payeeParticipantId', 'pe.accountId')
    .innerJoin('accounts AS pr', 'fees.payerParticipantId', 'pr.accountId')
    .whereNull('sf.feeId')
    .distinct('fees.feeId AS feeId', 'pe.name AS payeeAccountName', 'pr.name AS payerAccountName', 'fees.amount AS payeeAmount', 'fees.amount AS payerAmount')
}
