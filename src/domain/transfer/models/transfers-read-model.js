'use strict'

const Moment = require('moment')
const Db = require('../../../db')
const TransferState = require('../state')
const Logger = require('@mojaloop/central-services-shared').Logger

const findExpired = (expiresAt) => {
  const expirationDate = (expiresAt || Moment.utc()).toISOString()
  return Db.transfer.find({ state: TransferState.PREPARED, 'expirationDate <': expirationDate })
}

const saveTransfer = (record) => {
  Logger.info('inside save transfer' + record.toString())
  return Db.transfer.insert(record).catch(err => {
    throw err
  })
}

const getAll = () => {
  return Db.transfer.query(builder => {
    return builder
      .innerJoin('accounts AS ca', 'transfer.payerParticipantId', 'ca.accountId')
      .innerJoin('accounts AS da', 'transfer.payeeParticipantId', 'da.accountId')
      .select('transfer.*', 'ca.name AS creditAccountName', 'da.name AS debitAccountName')
  })
}

const updateTransfer = (transferId, fields) => {
  return Db.transfer.update({ transferId: transferId }, fields).catch(err => {
    Logger.info(err)
    throw err
  })
}

const truncateTransfers = () => {
  return Db.transfer.truncate()
}

const getById = (id) => {
  return Db.transfer.query(builder => {
    return builder
      .where({ transferId: id })
      .innerJoin('accounts AS ca', 'transfer.payerParticipantId', 'ca.accountId')
      .innerJoin('accounts AS da', 'transfer.payeeParticipantId', 'da.accountId')
      .select('transfer.*', 'ca.name AS creditAccountName', 'da.name AS debitAccountName')
      .first()
  })
}

module.exports = {
  findExpired,
  saveTransfer,
  getAll,
  updateTransfer,
  truncateTransfers,
  getById
}
