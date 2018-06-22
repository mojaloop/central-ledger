'use strict'

const Db = require('../db')

exports.create = (fee) => {
  return Db.settledFee.insert({ feeId: fee.feeId, settlementId: fee.settlementId })
}

exports.truncate = () => {
  return Db.settledFee.truncate()
}
