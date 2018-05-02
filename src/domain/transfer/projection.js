'use strict'

const _ = require('lodash')
const UrlParser = require('../../lib/urlparser')
const Util = require('../../lib/util')
const ParticipantService = require('../../domain/participant')
const TransferState = require('./state')
const TransferRejectionType = require('./rejection-type')
const TransfersReadModel = require('./models/transfers-read-model')
const ExecuteTransfersModel = require('../../models/executed-transfers')
const SettledTransfersModel = require('../../models/settled-transfers')

const saveTransferPrepared = async (payload) => {
  const debitParticipant = await UrlParser.nameFromParticipantUri(payload.debits[0].participant)
  const creditParticipant = await UrlParser.nameFromParticipantUri(payload.credits[0].participant)
  const names = [debitParticipant, creditParticipant]
  const participants = []
  for (var i = 0, len = names.length; i < len; i++) {
    const participant = await ParticipantService.getByName(names[i])
    participants.push(participant)
  }
  const participantIds = await _.reduce(participants, (m, acct) => _.set(m, acct.name, acct.participantId), {})
  const record = {
    transferId: payload.id,
    state: TransferState.PREPARED,
    ledger: payload.ledger,
    payeeParticipantId: participantIds[debitParticipant],
    payeeAmount: payload.debits[0].amount,
    payeeNote: JSON.stringify(payload.debits[0].memo),
    payerParticipantId: participantIds[creditParticipant],
    payerAmount: payload.credits[0].amount,
    payerNote: JSON.stringify(payload.credits[0].memo),
    payeeRejected: 0,
    payeeRejectionMessage: null,
    executionCondition: payload.execution_condition,
    cancellationCondition: payload.cancellation_condition,
    fulfillment: null,
    rejectionReason: payload.rejection_reason,
    expirationDate: new Date(payload.expires_at),
    additionalInfo: payload.additional_info,
    preparedDate: payload.timeline.prepared_at,
    executedDate: null,
    rejectedDate: null
  }
  await TransfersReadModel.saveTransfer(record).catch(err => {
    throw new Error(err.message)
  })
  record.creditParticipantName = creditParticipant
  record.debitParticipantName = debitParticipant
  return record
}

const saveTransferExecuted = async ({payload, timestamp}) => {
  const fields = {
    state: TransferState.EXECUTED,
    fulfillment: payload.fulfillment,
    executedDate: new Date(timestamp)
  }
  return await TransfersReadModel.updateTransfer(payload.id, fields)
}

const saveTransferRejected = async ({aggregate, payload, timestamp}) => {
  const fields = {
    state: TransferState.REJECTED,
    rejectionReason: payload.rejection_reason,
    rejectedDate: new Date(timestamp)
  }
  if (payload.rejection_reason === TransferRejectionType.CANCELLED) {
    Util.assign(fields, {
      payeeRejected: 1,
      payeeRejectionMessage: payload.message || ''
    })
  }
  return await TransfersReadModel.updateTransfer(aggregate.id, fields)
}

const saveExecutedTransfer = async (transfer) => {
  await ExecuteTransfersModel.create(transfer.payload.id)
}

const saveSettledTransfers = async ({id, settlement_id}) => {
  await SettledTransfersModel.create({id, settlement_id})
}

module.exports = {
  saveTransferPrepared,
  saveTransferExecuted,
  saveTransferRejected,
  saveExecutedTransfer,
  saveSettledTransfers
}
