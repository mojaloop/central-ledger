'use strict'

const _ = require('lodash')
// const UrlParser = require('../../lib/urlparser')
const Util = require('../../lib/util')
// const Moment = require('moment')
const ParticipantService = require('../../domain/participant')
const TransferState = require('./state')
const TransferRejectionType = require('./rejection-type')
const TransfersModel = require('./models/transfers-read-model')
const ilpModel = require('../../models/ilp')
const transferStateChangeModel = require('./models/transferStateChanges')
const ExecuteTransfersModel = require('../../models/executed-transfers')
const SettledTransfersModel = require('../../models/settled-transfers')

const saveTransferPrepared = async (payload) => {
  // const debitParticipant = await UrlParser.nameFromParticipantUri(payload.debits[0].participant)
  // const creditParticipant = await UrlParser.nameFromParticipantUri(payload.credits[0].participant)
  // const names = [debitParticipant, creditParticipant]

  const participants = {}

  // for (var i = 0, len = names.length; i < len; i++) {
  //   const participant = await ParticipantService.getByName(names[i])
  //   participants.push(participant)
  // }

  const names = [payload.payeeFsp, payload.payerFsp]

  names.forEach(async (name) => {
    const participant = await ParticipantService.getByName(name)
    participants.push(participant)
  })

  const participantIds = await _.reduce(participants, (m, acct) => _.set(m, acct.name, acct.participantId), {})

  const transferRecord = {
    transferId: payload.transferId,
    payeeParticipantId: participantIds[payload.payeeFsp],
    payerParticipantId: participantIds[payload.payerFsp],
    amount: payload.amount.amount,
    currencyId: payload.amount.currency,
    expirationDate: new Date(payload.expiration)
  }

  const ilpRecord = {
    transferId: payload.transferId,
    packet: payload.ilpPacket,
    condition: payload.condition,
    fulfillment: null
  }

  const transferStateRecord = {
    transferId: payload.transferId,
    transferStateId: TransferState.RECEIVED,
    reason: 'Received Transfer for Prepare',
    changedDate: (new Date()).toISOString()
  }

  // TODO: ExtensionList
  // TODO: Move inserts into a Transaction

  await ilpModel.saveIlp(ilpRecord).catch(err => {
    throw new Error(err.message)
  })

  await transferStateChangeModel.saveTransferStateChange(transferStateRecord).catch(err => {
    throw new Error(err.message)
  })

  await TransfersModel.saveTransfer(transferRecord).catch(err => {
    throw new Error(err.message)
  })

  // transferRecord.creditParticipantName = creditParticipant
  // transferRecord.debitParticipantName = debitParticipant
  return { transferRecord, ilpRecord, transferStateRecord }
}

const saveTransferExecuted = async ({payload, timestamp}) => {
  const fields = {
    state: TransferState.EXECUTED,
    fulfillment: payload.fulfillment,
    executedDate: new Date(timestamp)
  }
  return await TransfersModel.updateTransfer(payload.id, fields)
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
  return await TransfersModel.updateTransfer(aggregate.id, fields)
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
