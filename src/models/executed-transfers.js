'use strict'

const Db = require('../db')

exports.create = (transfer) => {
  return Db.executedTransfers.insert({ transferId: transfer.id })
}

exports.truncate = () => {
  return Db.executedTransfers.truncate()
}
