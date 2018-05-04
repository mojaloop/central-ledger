'use strict'

// const Moment = require('moment')
const Db = require('../../../db')
// const TransferState = require('../state')
const Logger = require('@mojaloop/central-services-shared').Logger

const saveTransferState = (transferState) => {
  Logger.debug('save transferState' + transferState.toString())
  return Db.transferState.insert(transferState).catch(err => {
    throw err
  })
}

const getByTransferStateId = (id) => {
  return Db.transferStateChange.query(builder => {
    return builder
      .where({ transferStateId: id })
      .select('transferState.*')
      .first()
  })
}

const getAll = (id) => {
  return Db.transferStateChange.query(builder => {
    return builder
      .select('transferState.*')
  })
}

const truncateTransferStates = () => {
  return Db.transfer.truncate()
}

module.exports = {
  saveTransferState,
  getByTransferStateId,
  getAll,
  truncateTransferStates
}
