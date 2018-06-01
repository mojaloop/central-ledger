'use strict'

const Transfer = require('../../domain/transfer')

function entityItem (transfer) {
  return {
    transferId: transfer.transferId,
    transferBatchId: transfer.transferBatchId,
    transferState: transfer.transferState,
    ledger: transfer.ledger,
    payeeParticipantId: transfer.payeeParticipantId,
    payeeAmount: transfer.payeeAmount,
    payeeNote: transfer.payeeNote,
    payerParticipantId: transfer.payerParticipantId,
    payerAmount: transfer.payerAmount,
    payerNote: transfer.payerNote,
    payeeRejected: transfer.payeeRejected,
    payeeRejectionMessage: transfer.payeeRejectionMessage,
    executionCondition: transfer.executionCondition,
    cancellationCondition: transfer.cancellationCondition,
    fulfilment: transfer.fulfilment,
    rejectionReason: transfer.rejectionReason,
    expirationDate: transfer.expirationDate,
    additionalInfo: transfer.additionalInfo,
    preparedDate: transfer.preparedDate,
    executedDate: transfer.executedDate,
    rejectedDate: transfer.rejectedDate,
    creditParticipantName: transfer.creditParticipantName,
    debitParticipantName: transfer.debitParticipantName
  }
}

const getAll = async function (request, h) {
  const transfers = await Transfer.getAll()
  return transfers.map(entityItem)
}

module.exports = {
  getAll
}
