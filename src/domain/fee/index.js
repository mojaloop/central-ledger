'use strict'

const P = require('bluebird')
const Model = require('./model')
const Charges = require('../charge')
const Account = require('../account')
const SettlementsModel = require('../../models/settlements')
const SettledFee = require('../../models/settled-fees.js')
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
      return Util.formatAmount(charge.rate * transfer.creditAmount)
    case FLAT:
      return charge.rate
  }
}

const getAccountIdFromTransferForCharge = (account, transfer) => {
  switch (account) {
    case SENDER:
      return P.resolve(transfer.debitAccountId)
    case RECEIVER:
      return P.resolve(transfer.creditAccountId)
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

    return P.all([getAccountIdFromTransferForCharge(charge.payer, transfer), getAccountIdFromTransferForCharge(charge.payee, transfer)]).then(([payerAccountId, payeeAccountId]) => {
      const amount = generateFeeAmount(charge, transfer)
      const fee = {
        transferId: transfer.transferUuid,
        amount,
        payerAccountId,
        payeeAccountId,
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

const getUnsettledFees = () => {
  return Model.getUnsettledFees()
}

const getUnsettledFeesByAccount = (account) => {
  return Model.getUnsettledFeesByAccount(account)
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
  const settlementId = SettlementsModel.generateId()
  await SettlementsModel.create(settlementId, 'fee')
  const settlement = await SettlementsModel.findById(settlementId)
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
  getUnsettledFees,
  getUnsettledFeesByAccount,
  settleFeesForTransfers
}
