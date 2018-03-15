'use strict'

const Moment = require('moment')
const Db = require('../../../db')
const TransferState = require('../state')
const Logger = require('@mojaloop/central-services-shared').Logger
const findExpired = (expirationDate) => {
  const expiresAt = (expirationDate || Moment.utc()).toISOString()
  return Db.transfers.find({ state: TransferState.PREPARED, 'expiresAt <': expiresAt })
}

const saveTransfer = (record) => {
  Logger.info('Another friggin log')
  Logger.info(Db.transfers.insert(record))
  return Db.transfers.insert(record).catch(err => {
    Logger.info('error thrown on save ' + err)
    Logger.error(err)
    Logger.info(record)
  })
}

const getAll = () => {
  return Db.transfers.query(builder => {
    return builder
      .innerJoin('accounts AS ca', 'transfers.creditAccountId', 'ca.accountId')
      .innerJoin('accounts AS da', 'transfers.debitAccountId', 'da.accountId')
      .select('transfers.*', 'ca.name AS creditAccountName', 'da.name AS debitAccountName')
  })
}

const updateTransfer = (transferId, fields) => {
  return Db.transfers.update({ transferUuid: transferId }, fields)
}

const truncateTransfers = () => {
  return Db.transfers.truncate()
}

const getById = (id) => {
  return Db.transfers.query(builder => {
    return builder
      .where({ transferUuid: id })
      .innerJoin('accounts AS ca', 'transfers.creditAccountId', 'ca.accountId')
      .innerJoin('accounts AS da', 'transfers.debitAccountId', 'da.accountId')
      .select('transfers.*', 'ca.name AS creditAccountName', 'da.name AS debitAccountName')
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
