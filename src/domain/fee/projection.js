'use strict'

const DA = require('deasync-promise')
const Logger = require('@mojaloop/central-services-shared').Logger
const FeeService = require('./index')

const initialize = (params, done) => {
  return done()
}

const handleTransferExecuted = (transfer) => {
  return DA(FeeService.generateFeesForTransfer(transfer)
    .catch(err => {
      Logger.error('Error handling TransferExecuted event', err)
    }))
}

module.exports = {
  initialize,
  handleTransferExecuted
}
