'use strict'

const P = require('bluebird')
const Model = require('./model')
const Charge = require('../charge')
const Participant = require('../participant')
const SettlementModel = require('../../models/settlement')
const SettledFee = require('../../models/settled-fee.js')
const Util = require('../../../src/lib/util')
const Config = require('../../../src/lib/config')

const PERCENTAGE = 'percent'
const FLAT = 'flat'
const SENDER = 'sender'
const RECEIVER = 'receiver'
const LEDGER = 'ledger'

const generateFeeAmount = (charge, transfer) => {
  switch (charge.rateType) {
    case PERCENTAGE:
      return Util.formatAmount(charge.rate * transfer.payerAmount)
    case FLAT:
      return charge.rate
  }
}

const getParticipantIdFromTransferForCharge = (participant, transfer) => {
  switch (participant) {
    case SENDER:
      return P.resolve(transfer.payeeParticipantId)
    case RECEIVER:
      return P.resolve(transfer.payerParticipantId)
    case LEDGER:
      return Participant.getByName(Config.LEDGER_ACCOUNT_NAME).then(participant => participant.participantId)
  }
}

const doesExist = (charge, transfer) => {
  return Model.doesExist(charge, transfer)
}

const create = (charge, transfer) => {
  return doesExist(charge, transfer).then(existingFee => {
    if (existingFee) {
      return existingFee
    }

    return P.all([getParticipantIdFromTransferForCharge(charge.payerParticipantId, transfer), getParticipantIdFromTransferForCharge(charge.payeeParticipantId, transfer)]).then(([payerParticipantId, payeeParticipantId]) => {
      const amount = generateFeeAmount(charge, transfer)
      const fee = {
        transferId: transfer.transferId,
        amount,
        payerParticipantId,
        payeeParticipantId,
        chargeId: charge.chargeId
      }
      return Model.create(fee)
    })
  })
}

const getAllForTransfer = (transfer) => {
  return Model.getAllForTransfer(transfer)
}

const generateFeeForTransfer = (transfer) => {
  return Charge.getAllForTransfer(transfer).then(charges => {
    return P.all(charges.map(charge => create(charge, transfer)))
  })
}

const getUnsettledFee = () => {
  return Model.getUnsettledFee()
}

const getUnsettledFeeByParticipant = (participant) => {
  return Model.getUnsettledFeeByParticipant(participant)
}

const settleFee = (fee, settlement) => {
  return SettledFee.create({ feeId: fee.feeId, settlementId: settlement.settlementId }).then(settledFee => fee)
}

const reduceFee = (unflattenedFee) => {
  const flattened = []
  unflattenedFee.forEach(fee => {
    fee.forEach(fee => {
      if (!flattened.includes(fee)) {
        flattened.push(fee)
      }
    })
  })
  return flattened
}

const settleFeeForTransfers = async (transfers) => {
  const settlementId = SettlementModel.generateId()
  await SettlementModel.create(settlementId, 'fee')
  const settlement = await SettlementModel.findById(settlementId)
  return P.all(transfers.map(transfer => {
    return Model.getSettleableFeeForTransfer(transfer).then(fee => {
      return P.all(fee.map(fee => settleFee(fee, settlement)))
    })
  })).then(unflattenedFee => {
    return reduceFee(unflattenedFee)
  })
}

module.exports = {
  getAllForTransfer,
  generateFeeForTransfer,
  getUnsettledFee,
  getUnsettledFeeByParticipant,
  settleFeeForTransfers
}
