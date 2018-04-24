'use strict'

const Db = require('../../db')

exports.create = (fee) => {
  return Db.fee.insert(fee)
}

exports.getAllForTransfer = (transfer) => {
  return Db.fee.find({ transferId: transfer.transferId })
}

exports.getSettleableFeeForTransfer = (transfer) => {
  return Db.fee.query(builder => {
    return buildSettleableFeeQuery(builder).where('fee.transferId', transfer.transferId)
  })
}

exports.doesExist = (charge, transfer) => {
  return Db.fee.findOne({ transferId: transfer.transferId, chargeId: charge.chargeId })
}

exports.getUnsettledFee = () => {
  return Db.fee.query(buildUnsettledFeeQuery)
}

exports.getUnsettledFeeByAccount = (account) => {
  return Db.fee.query(builder => {
    return buildUnsettledFeeQuery(builder).andWhere(q => q.where('fee.payerParticipantId', account.accountId).orWhere('fee.payeeParticipantId', account.accountId))
  })
}

const buildSettleableFeeQuery = (builder) => {
  return builder
    .leftJoin('settledFee AS sf', 'fee.feeId', 'sf.feeId')
    .innerJoin('accounts AS pe', 'fee.payeeParticipantId', 'pe.accountId')
    .innerJoin('accounts AS pr', 'fee.payerParticipantId', 'pr.accountId')
    .innerJoin('accountsSettlement AS ss', 'fee.payerParticipantId', 'ss.accountId')
    .innerJoin('accountsSettlement AS sd', 'fee.payeeParticipantId', 'sd.accountId')
    .whereNull('sf.feeId')
    .distinct('fee.feeId AS feeId', 'pe.name AS payeeAccountName', 'pr.name AS payerAccountName', 'fee.amount AS payeeAmount', 'fee.amount AS payerAmount', 'ss.accountNumber AS sourceAccountNumber', 'ss.routingNumber AS sourceRoutingNumber', 'sd.accountNumber AS destinationAccountNumber', 'sd.routingNumber AS destinationRoutingNumber')
}

const buildUnsettledFeeQuery = (builder) => {
  return builder
    .leftJoin('settledFee AS sf', 'fee.feeId', 'sf.feeId')
    .innerJoin('accounts AS pe', 'fee.payeeParticipantId', 'pe.accountId')
    .innerJoin('accounts AS pr', 'fee.payerParticipantId', 'pr.accountId')
    .whereNull('sf.feeId')
    .distinct('fee.feeId AS feeId', 'pe.name AS payeeAccountName', 'pr.name AS payerAccountName', 'fee.amount AS payeeAmount', 'fee.amount AS payerAmount')
}
