'use strict'

const Moment = require('moment')
const Db = require('../../../db')
const TransferState = require('../state')

const findExpired = (expirationDate) => {
  const expiresAt = (expirationDate || Moment.utc()).toISOString()
  return Db.transfers.find({ state: TransferState.PREPARED, 'expiresAt <': expiresAt })
}

const saveTransfer = (record) => {
  return Db.transfers.insert(record)
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
