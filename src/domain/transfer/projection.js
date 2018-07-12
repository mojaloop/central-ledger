'use strict'

const _ = require('lodash')
const Uuid = require('uuid4')
const Enum = require('../../lib/enum')
const ParticipantFacade = require('../../models/participant/facade')
// const TransferFacade = require('../../models/transfer/facade')
const TransferModel = require('../../models/transfer/transfer')
const TransferParticipantModel = require('../../models/transfer/transferParticipant')
const ilpPacketModel = require('../../models/transfer/ilpPacket')
const transferExtensionModel = require('../../models/transfer/transferExtension')
const transferStateChangeModel = require('../../models/transfer/transferStateChange')
const TransferFulfilmentModel = require('../../models/transfer/transferFulfilment')

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

    const state = ((hasPassedValidation) ? Enum.TransferState.RECEIVED_PREPARE : Enum.TransferState.REJECTED)

    const transferStateChangeRecord = {
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

    // First save transfer to ensure foreign key integrity
    await TransferModel.saveTransfer(transferRecord)

    await TransferParticipantModel.saveTransferParticipant(payerTransferParticipantRecord)
    await TransferParticipantModel.saveTransferParticipant(payeeTransferParticipantRecord)
    payerTransferParticipantRecord.name = payload.payerFsp
    payeeTransferParticipantRecord.name = payload.payeeFsp

    let transferExtensionsRecordList = []
    if (payload.extensionList && payload.extensionList.extension) {
      transferExtensionsRecordList = payload.extensionList.extension.map(ext => {
        return {
          transferId: payload.transferId,
          key: ext.key,
          value: ext.value
        }
      })
      for (let ext of transferExtensionsRecordList) {
        await transferExtensionModel.saveTransferExtension(ext)
      }
    }

    await ilpPacketModel.saveIlpPacket(ilpPacketRecord)

    await transferStateChangeModel.saveTransferStateChange(transferStateChangeRecord)

    return {
      isSaveTransferPrepared: true,
      transferRecord,
      payerTransferParticipantRecord,
      payeeTransferParticipantRecord,
      ilpPacketRecord,
      transferStateChangeRecord,
      transferExtensionsRecordList
    }
  } catch (e) {
    throw e
  }
}

const saveTransferExecuted = async (transferId, payload, stateReason = null, hasPassedValidation = true) => {
  let transferFulfilmentId = Uuid() // TODO: should be generated once before TransferFulfilmentDuplicateCheck (and passed here)
  const transferFulfilmentRecord = {
    transferFulfilmentId,
    transferId,
    ilpFulfilment: payload.fulfilment,
    completedDate: new Date(payload.completedTimestamp),
    isValid: true,
    createdDate: new Date()
  }

  const state = ((hasPassedValidation) ? Enum.TransferState.RECEIVED_FULFIL : Enum.TransferState.ABORTED)
  const transferStateChangeRecord = {
    transferId,
    transferStateId: state,
    reason: stateReason,
    createdDate: new Date()
  }
  // TODO: Move inserts into a Transaction

  await TransferFulfilmentModel.saveTransferFulfilment(transferFulfilmentRecord)

  let transferExtensionsRecordList = []
  if (payload.extensionList && payload.extensionList.extension) {
    transferExtensionsRecordList = payload.extensionList.extension.map(ext => {
      return {
        transferId,
        transferFulfilmentId,
        key: ext.key,
        value: ext.value
      }
    })
    for (let ext of transferExtensionsRecordList) {
      await transferExtensionModel.saveTransferExtension(ext)
    }
  }

  await transferStateChangeModel.saveTransferStateChange(transferStateChangeRecord)

  return {
    isSaveTransferExecuted: true,
    transferFulfilmentRecord,
    transferStateChangeRecord,
    transferExtensionsRecordList
  }
}

// This update should only be done if the transfer id only has the state RECEIVED //TODO
const updateTransferState = async (payload, state) => {
  const transferStateChangeRecord = {
    transferId: payload.transferId,
    transferStateId: state,
    // reason: '',
    createdDate: new Date()
  }
  return await transferStateChangeModel.saveTransferStateChange(transferStateChangeRecord)
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
