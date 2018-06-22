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

exports.getUnsettledFeeByParticipant = (participant) => {
  return Db.fee.query(builder => {
    return buildUnsettledFeeQuery(builder).andWhere(q => q.where('fee.payerParticipantId', participant.participantId).orWhere('fee.payeeParticipantId', participant.participantId))
  })
}

const buildSettleableFeeQuery = (builder) => {
  return builder
    .leftJoin('settledFee AS sf', 'fee.feeId', 'sf.feeId')
    .innerJoin('participant AS pe', 'fee.payeeParticipantId', 'pe.participantId')
    .innerJoin('participant AS pr', 'fee.payerParticipantId', 'pr.participantId')
    .innerJoin('participantSettlement AS ss', 'fee.payerParticipantId', 'ss.participantId')
    .innerJoin('participantSettlement AS sd', 'fee.payeeParticipantId', 'sd.participantId')
    .whereNull('sf.feeId')
    .distinct('fee.feeId AS feeId', 'pe.name AS payeeParticipantName', 'pr.name AS payerParticipantName', 'fee.amount AS payeeAmount', 'fee.amount AS payerAmount', 'ss.participantNumber AS sourceParticipantNumber', 'ss.routingNumber AS sourceRoutingNumber', 'sd.participantNumber AS destinationParticipantNumber', 'sd.routingNumber AS destinationRoutingNumber')
}

const buildUnsettledFeeQuery = (builder) => {
  return builder
    .leftJoin('settledFee AS sf', 'fee.feeId', 'sf.feeId')
    .innerJoin('participant AS pe', 'fee.payeeParticipantId', 'pe.participantId')
    .innerJoin('participant AS pr', 'fee.payerParticipantId', 'pr.participantId')
    .whereNull('sf.feeId')
    .distinct('fee.feeId AS feeId', 'pe.name AS payeeParticipantName', 'pr.name AS payerParticipantName', 'fee.amount AS payeeAmount', 'fee.amount AS payerAmount')
}
