'use strict'

const _ = require('lodash')
const Enum = require('../enum')
const ParticipantFacade = require('../../models/participant/facade')
const TransfersModel = require('../../models/transfer/facade')
const transferParticipantModel = require('../../models/transfer/transferParticipant')
const ilpPacketModel = require('../../models/transfer/ilpPacket')
const transferExtensionModel = require('../../models/transfer/transferExtension')
const transferStateChangeModel = require('../../models/transfer/transferStateChange')

const saveTransferPrepared = async (payload, stateReason = null, hasPassedValidation = true) => {
  try {
    const participants = []
    const names = [payload.payeeFsp, payload.payerFsp]

    for (let name of names) {
      const participant = await ParticipantFacade.getByNameAndCurrency(name, payload.amount.currency)
      participants.push(participant)
    }

    const participantCurrencyIds = await _.reduce(participants, (m, acct) =>
      _.set(m, acct.name, acct.participantCurrencyId), {})

    const transferRecord = {
      transferId: payload.transferId,
      amount: payload.amount.amount,
      currencyId: payload.amount.currency,
      ilpCondition: payload.condition,
      expirationDate: new Date(payload.expiration)
    }

    const ilpPacketRecord = {
      transferId: payload.transferId,
      value: payload.ilpPacket
    }

    const state = ((hasPassedValidation) ? Enum.TransferState.RECEIVED_PREPARE : Enum.TransferState.ABORTED)

    const transferStateRecord = {
      transferId: payload.transferId,
      transferStateId: state,
      reason: stateReason,
      createdDate: new Date()
    }

    const payerTransferParticipantRecord = {
      transferId: payload.transferId,
      participantCurrencyId: participantCurrencyIds[payload.payerFsp],
      transferParticipantRoleTypeId: Enum.TransferParticipantRoleType.PAYER_DFSP,
      ledgerEntryTypeId: Enum.LedgerEntryType.PRINCIPLE_VALUE,
      amount: payload.amount.amount
    }

    const payeeTransferParticipantRecord = {
      transferId: payload.transferId,
      participantCurrencyId: participantCurrencyIds[payload.payeeFsp],
      transferParticipantRoleTypeId: Enum.TransferParticipantRoleType.PAYEE_DFSP,
      ledgerEntryTypeId: Enum.LedgerEntryType.PRINCIPLE_VALUE,
      amount: payload.amount.amount
    }
    // TODO: Move inserts into a Transaction

    // first save transfer to ensure foreign key integrity
    await TransfersModel.saveTransfer(transferRecord)

    await transferParticipantModel.saveTransferParticipant(payerTransferParticipantRecord)
    await transferParticipantModel.saveTransferParticipant(payeeTransferParticipantRecord)
    payerTransferParticipantRecord.name = payload.payerFsp
    payeeTransferParticipantRecord.name = payload.payeeFsp

    var transferExtensionsRecordList = []

    if (payload.extensionList && payload.extensionList.extension) {
      transferExtensionsRecordList = payload.extensionList.extension.map(ext => {
        return {
          transferId: payload.transferId,
          key: ext.key,
          value: ext.value
        }
      })
      for (let ext of transferExtensionsRecordList) {
        await transferExtensionModel.saveExtension(ext)
      }
    }

    await ilpPacketModel.saveIlpPacket(ilpPacketRecord)

    await transferStateChangeModel.saveTransferStateChange(transferStateRecord)

    return {
      isSaveTransferPrepared: true,
      transferRecord,
      payerTransferParticipantRecord,
      payeeTransferParticipantRecord,
      ilpPacketRecord,
      transferStateRecord,
      transferExtensionsRecordList
    }
  } catch (e) {
    throw e
  }
}

const saveTransferExecuted = async ({payload, timestamp}) => {
  const fields = {
    state: Enum.TransferState.COMMITTED,
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
    createdDate: new Date()
  }
  return await transferStateChangeModel.saveTransferStateChange(transferStateRecord)
}

const saveTransferRejected = async (stateReason, transferId) => {
  try {
    const existingtransferStateChange = await transferStateChangeModel.getByTransferId(transferId)

    let existingAbort = false
    let transferStateChange
    if (Array.isArray(existingtransferStateChange)) {
      for (let transferState of existingtransferStateChange) {
        if (transferState.transferStateId === Enum.TransferState.ABORTED) {
          existingAbort = true
          transferStateChange = transferState
          break
        }
      }
    } else {
      if (existingtransferStateChange.transferStateId === Enum.TransferState.ABORTED) {
        existingAbort = true
        transferStateChange = existingtransferStateChange
      }
    }
    if (!existingAbort) {
      transferStateChange = {}
      transferStateChange.transferStateChangeId = null
      transferStateChange.transferId = transferId
      transferStateChange.reason = stateReason
      transferStateChange.changedDate = new Date()
      transferStateChange.transferStateId = Enum.TransferState.ABORTED
      await transferStateChangeModel.saveTransferStateChange(transferStateChange)
      return {alreadyRejected: false, transferStateChange}
    } else {
      return {alreadyRejected: true, transferStateChange}
    }
  } catch (e) {
    throw e
  }
}

module.exports = {
  saveTransferPrepared,
  saveTransferExecuted,
  saveTransferRejected,
  updateTransferState
}
