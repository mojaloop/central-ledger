'use strict'

const Db = require('../db')

exports.create = (fee) => {
  return Db.settledFees.insert({ feeId: fee.feeId, settlementId: fee.settlementId })
}

exports.truncate = () => {
  return Db.settledFees.truncate()
}
