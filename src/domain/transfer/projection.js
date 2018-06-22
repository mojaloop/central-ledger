'use strict'

const _ = require('lodash')
const ParticipantService = require('../../domain/participant')
const TransferState = require('./state')
const TransfersModel = require('./models/transfer-read-model')
const ilpModel = require('../../models/ilp')
const extensionModel = require('../../models/extensions')
const transferStateChangeModel = require('./models/transferStateChanges')
const ExecuteTransfersModel = require('../../models/executed-transfers')
const SettledTransfersModel = require('../../models/settled-transfers')

const saveTransferPrepared = async (payload, stateReason = null, hasPassedValidation = true) => {
  try {
    const participants = []
    const names = [payload.payeeFsp, payload.payerFsp]

    for (let name of names) {
      const participant = await ParticipantService.getByName(name)
      participants.push(participant)
    }

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
      fulfilment: null
    }

    const state = ((hasPassedValidation) ? TransferState.RECEIVED : TransferState.ABORTED)

    const transferStateRecord = {
      transferId: payload.transferId,
      transferStateId: state,
      reason: stateReason,
      changedDate: new Date()
    }

    // TODO: Move inserts into a Transaction

    // first save transfer to make sure the foreign key integrity for ilp, transferStateChange and extensions
    await TransfersModel.saveTransfer(transferRecord)

    var extensionsRecordList = []

    if (payload.extensionList && payload.extensionList.extension) {
      extensionsRecordList = payload.extensionList.extension.map(ext => {
        return {
          transferId: payload.transferId,
          key: ext.key,
          value: ext.value,
          changedDate: new Date(),
          changedBy: 'user' // this needs to be changed and cannot be null
        }
      })
      for (let ext of extensionsRecordList) {
        await extensionModel.saveExtension(ext)
      }
    }

    await ilpModel.saveIlp(ilpRecord)

    await transferStateChangeModel.saveTransferStateChange(transferStateRecord)

    return {isSaveTransferPrepared: true, transferRecord, ilpRecord, transferStateRecord, extensionsRecordList}
  } catch (e) {
    throw e
  }
}

const saveTransferExecuted = async ({payload, timestamp}) => {
  const fields = {
    state: TransferState.COMMITTED,
    fulfilment: payload.fulfilment,
    executedDate: new Date(timestamp)
  }
  return await TransfersModel.updateTransfer(payload.id, fields)
}
// This update should only be done if the transfer id only has the state RECEIVED //TODO
const updateTransferState = async (payload, state) => {
  const transferStateRecord = {
    transferId: payload.transferId,
    transferStateId: state,
    reason: '',
    changedDate: new Date()
  }
  return await transferStateChangeModel.saveTransferStateChange(transferStateRecord)
}

const saveTransferRejected = async (stateReason, transferId) => {
  try {
    const existingTransferStateChanges = await transferStateChangeModel.getByTransferId(transferId)

    let existingAbort = false
    let transferStateChange
    if (Array.isArray(existingTransferStateChanges)) {
      for (let transferState of existingTransferStateChanges) {
        if (transferState.transferStateId === TransferState.ABORTED) {
          existingAbort = true
          transferStateChange = transferState
          break
        }
      }
    } else {
      if (existingTransferStateChanges.transferStateId === TransferState.ABORTED) {
        existingAbort = true
        transferStateChange = existingTransferStateChanges
      }
    }
    if (!existingAbort) {
      transferStateChange = {}
      transferStateChange.transferStateChangeId = null
      transferStateChange.transferId = transferId
      transferStateChange.reason = stateReason
      transferStateChange.changedDate = new Date()
      transferStateChange.transferStateId = TransferState.ABORTED
      await transferStateChangeModel.saveTransferStateChange(transferStateChange)
      return {alreadyRejected: false, transferStateChange}
    } else {
      return {alreadyRejected: true, transferStateChange}
    }
  } catch (e) {
    throw e
  }
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
  saveSettledTransfers,
  updateTransferState
}
