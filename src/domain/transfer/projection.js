'use strict'

const _ = require('lodash')
const Enum = require('../../lib/enum')
const ParticipantFacade = require('../../models/participant/facade')
const TransferModel = require('../../models/transfer/transfer')
const TransferParticipantModel = require('../../models/transfer/transferParticipant')
const ilpPacketModel = require('../../models/transfer/ilpPacket')
const transferExtensionModel = require('../../models/transfer/transferExtension')
const transferStateChangeModel = require('../../models/transfer/transferStateChange')

const saveTransferPrepared = async (payload, stateReason = null, hasPassedValidation = true) => {
  // TODO: Move inserts into a Transaction
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

module.exports = {
  saveTransferPrepared
}
