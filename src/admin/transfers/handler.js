'use strict'

const Transfer = require('../../domain/transfer')

function entityItem (transfer) {
  return {
    transferUuid: transfer.transferUuid,
    state: transfer.state,
    ledger: transfer.ledger,
    debitAccountId: transfer.debitAccountId,
    debitAmount: transfer.debitAmount,
    debitMemo: transfer.debitMemo,
    creditAccountId: transfer.creditAccountId,
    creditAmount: transfer.creditAmount,
    creditMemo: transfer.creditMemo,
    creditRejected: transfer.creditRejected,
    creditRejectionMessage: transfer.creditRejectionMessage,
    executionCondition: transfer.executionCondition,
    cancellationCondition: transfer.cancellationCondition,
    fulfillment: transfer.fulfillment,
    rejectionReason: transfer.rejectionReason,
    expiresAt: transfer.expiresAt,
    additionalInfo: transfer.additionalInfo,
    preparedDate: transfer.preparedDate,
    executedDate: transfer.executedDate,
    rejectedDate: transfer.rejectedDate,
    creditAccountName: transfer.creditAccountName,
    debitAccountName: transfer.debitAccountName
  }
}

const getAll = (request, reply) => {
  Transfer.getAll()
    .then(results => results.map(entityItem))
    .then(result => reply(result))
    .catch(e => reply(e))
}

module.exports = {
  getAll
}
