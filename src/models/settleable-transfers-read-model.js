'use strict'

const Db = require('../db')

exports.getSettleableTransfers = () => {
  return Db.executedTransfers.query(buildSettleableTransfersQuery)
}

exports.getUnsettledTransfers = () => {
  return Db.executedTransfers.query(buildUnsetttledTransfersQuery)
}

exports.getUnsettledTransfersByParticipant = (participantId) => {
  return Db.executedTransfers.query(builder => {
    return buildUnsetttledTransfersQuery(builder).andWhere(q => q.where('t.payerParticipantId', participantId).orWhere('t.payeeParticipantId', participantId))
  })
}

const buildSettleableTransfersQuery = (builder) => {
  return builder
    .leftJoin('settledTransfers AS st', 'executedTransfers.transferId', 'st.transferId')
    .innerJoin('transfer AS t', 'executedTransfers.transferId', 't.transferId')
    .innerJoin('participant AS ca', 't.payerParticipantId', 'ca.participantId')
    .innerJoin('participant AS da', 't.payeeParticipantId', 'da.participantId')
    .innerJoin('participantSettlement AS ss', 't.payeeParticipantId', 'ss.participantId')
    .innerJoin('participantSettlement AS sd', 't.payerParticipantId', 'sd.participantId')
    .whereNull('st.transferId')
    .distinct('executedTransfers.transferId AS transferId', 'ca.name AS creditParticipantName', 'da.name AS debitParticipantName', 't.payerAmount AS payerAmount', 't.payeeAmount AS payeeAmount', 'ss.participantNumber AS sourceParticipantNumber', 'ss.routingNumber AS sourceRoutingNumber', 'sd.participantNumber AS destinationParticipantNumber', 'sd.routingNumber AS destinationRoutingNumber')
}

const buildUnsetttledTransfersQuery = (builder) => {
  return builder
    .leftJoin('settledTransfers AS st', 'executedTransfers.transferId', 'st.transferId')
    .innerJoin('transfer AS t', 'executedTransfers.transferId', 't.transferId')
    .innerJoin('participant AS ca', 't.payerParticipantId', 'ca.participantId')
    .innerJoin('participant AS da', 't.payeeParticipantId', 'da.participantId')
    .whereNull('st.transferId')
    .distinct('executedTransfers.transferId AS transferId', 'ca.name AS creditParticipantName', 'da.name AS debitParticipantName', 't.payerAmount AS payerAmount', 't.payeeAmount AS payeeAmount')
}
