'use strict'

const TransferService = require('../../domain/transfer')

function entityItem (transfer) {
  return {
    transferId: transfer.transferId,
    settlementWindowId: transfer.settlementWindowId,
    transferState: transfer.transferState,
    completedTimestamp: transfer.completedTimestamp,
    debitParticipantName: transfer.payerFsp,
    payerParticipantId: transfer.payerParticipantId,
    payerParticipantCurrencyId: transfer.payerParticipantCurrencyId,
    payerAmount: transfer.payerAmount,
    creditParticipantName: transfer.payeeFsp,
    payeeParticipantId: transfer.payeeParticipantId,
    payeeParticipantCurrencyId: transfer.payeeParticipantCurrencyId,
    payeeAmount: transfer.payeeAmount,
    condition: transfer.ilpCondition,
    fulfilment: transfer.fulfilment,
    rejectionReason: transfer.reason,
    expirationDate: transfer.expirationDate,
    amount: transfer.amount
    // ledger: transfer.ledger, // TODO: obsolete?
    // payerNote: transfer.payerNote, // TODO: obsolete?
    // payeeNote: transfer.payeeNote, // TODO: obsolete?
    // payeeRejected: transfer.payeeRejected, // TODO: obsolete?
    // payeeRejectionMessage: transfer.payeeRejectionMessage, // TODO: obsolete?
    // cancellationCondition: transfer.cancellationCondition, // TODO: obsolete?
    // additionalInfo: transfer.additionalInfo, // TODO: obsolete
    // preparedDate: transfer.createdDate, // moved to stateDate
    // executedDate: transfer.executedDate, // TODO: get transferFulfilment.createdDate
    // rejectedDate: transfer.rejectedDate, // TODO: get transferStateChange.createdDate (ABORTED)
  }
}

const getAll = async function (request, h) {
  const transfers = await TransferService.getAll()
  return transfers.map(entityItem)
}

module.exports = {
  getAll
}
