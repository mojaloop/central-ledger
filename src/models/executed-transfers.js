'use strict'

const Db = require('../db')

exports.create = (transferId) => {
  return Db.executedTransfers.insert({ transferId: transferId })
}

exports.truncate = () => {
  return Db.executedTransfers.truncate()
}
