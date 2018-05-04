'use strict'

// const Moment = require('moment')
const Db = require('../../../db')
// const TransferState = require('../state')
const Logger = require('@mojaloop/central-services-shared').Logger

const saveTransferStateChange = (stateChange) => {
  Logger.debug('save transferStateChange' + stateChange.toString())
  return Db.transferStateChange.insert(stateChange).catch(err => {
    throw err
  })
}

const getByTransferId = (id) => {
  return Db.transferStateChange.query(builder => {
    return builder
      .where({ transferId: id })
      .select('transferStateChange.*')
      .first()
  })
}

module.exports = {
  saveTransferStateChange,
  getByTransferId
}
