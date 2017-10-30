'use strict'

const DA = require('deasync-promise')
const Logger = require('@mojaloop/central-services-shared').Logger
const ExecutedTransfers = require('../../models/executed-transfers')
const SettledTransfers = require('../../models/settled-transfers')

module.exports = {
  initialize (params, done) {
    return ExecutedTransfers.truncate()
      .then(() => SettledTransfers.truncate())
      .then(() => done())
      .catch(err => {
        Logger.error('Error truncating read model', err)
      })
  },

  handleTransferExecuted (event) {
    return DA(ExecutedTransfers.create({ id: event.aggregate.id })
      .catch(err => {
        Logger.error('Error handling TransferExecuted event', err)
      }))
  },

  handleTransferSettled (event) {
    return DA(SettledTransfers.create({ id: event.aggregate.id, settlementId: event.payload.settlement_id })
      .catch(err => {
        Logger.error('Error handling TransferSettled event', err)
      }))
  }
}
