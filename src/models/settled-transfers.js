'use strict'

const Db = require('../db')

exports.create = (transfer) => {
  return Db.settledTransfers.insert({ transferId: transfer.id, settlementId: transfer.settlement_id })
}

exports.truncate = () => {
  return Db.settledTransfers.truncate()
}
