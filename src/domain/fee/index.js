'use strict'

const P = require('bluebird')
const Model = require('./model')
const Charges = require('../charge')
const Account = require('../account')
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

const getAccountIdFromTransferForCharge = (account, transfer) => {
  switch (account) {
    case SENDER:
      return P.resolve(transfer.payeeParticipantId)
    case RECEIVER:
      return P.resolve(transfer.payerParticipantId)
    case LEDGER:
      return Account.getByName(Config.LEDGER_ACCOUNT_NAME).then(account => account.accountId)
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

    return P.all([getAccountIdFromTransferForCharge(charge.payer, transfer), getAccountIdFromTransferForCharge(charge.payee, transfer)]).then(([payerParticipantId, payeeParticipantId]) => {
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

const generateFeesForTransfer = (transfer) => {
  return Charges.getAllForTransfer(transfer).then(charges => {
    return P.all(charges.map(charge => create(charge, transfer)))
  })
}

const getUnsettledFee = () => {
  return Model.getUnsettledFee()
}

const getUnsettledFeeByAccount = (account) => {
  return Model.getUnsettledFeeByAccount(account)
}

const settleFee = (fee, settlement) => {
  return SettledFee.create({ feeId: fee.feeId, settlementId: settlement.settlementId }).then(settledFee => fee)
}

const reduceFees = (unflattenedFees) => {
  const flattened = []
  unflattenedFees.forEach(fees => {
    fees.forEach(fee => {
      if (!flattened.includes(fee)) {
        flattened.push(fee)
      }
    })
  })
  return flattened
}

const settleFeesForTransfers = async (transfers) => {
  const settlementId = SettlementModel.generateId()
  await SettlementModel.create(settlementId, 'fee')
  const settlement = await SettlementModel.findById(settlementId)
  return P.all(transfers.map(transfer => {
    return Model.getSettleableFeesForTransfer(transfer).then(fees => {
      return P.all(fees.map(fee => settleFee(fee, settlement)))
    })
  })).then(unflattenedFees => {
    return reduceFees(unflattenedFees)
  })
}

module.exports = {
  getAllForTransfer,
  generateFeesForTransfer,
  getUnsettledFee,
  getUnsettledFeeByAccount,
  settleFeesForTransfers
}
