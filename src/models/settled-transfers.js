'use strict'

const Db = require('../db')

exports.create = (transfer) => {
  return Db.settledTransfers.insert({ transferId: transfer.id, settlementId: transfer.settlementId })
}

exports.truncate = () => {
  return Db.settledTransfers.truncate()
}
