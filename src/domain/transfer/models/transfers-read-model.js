'use strict'

const Moment = require('moment')
const Db = require('../../../db')
const TransferState = require('../state')
const extensionModel = require('../../../models/extensions')
const Logger = require('@mojaloop/central-services-shared').Logger

const findExpired = (expiresAt) => {
  const expirationDate = (expiresAt || Moment.utc()).toISOString()
  return Db.transfer.find({ state: TransferState.PREPARED, 'expirationDate <': expirationDate })
}

const saveTransfer = async (record) => {
  Logger.debug('save transfer' + record.toString())
  return await Db.transfer.returning('transferId').insert(record).catch(err => {
    throw err
  })
}

const getAll = async () => {
  return await Db.transfer.query(builder => {
    var transferResultList = builder
      .innerJoin('participant AS ca', 'transfer.payerParticipantId', 'ca.participantId')
      .innerJoin('participant AS da', 'transfer.payeeParticipantId', 'da.participantId')
      .innerJoin('transferStateChange AS tsc', 'transfer.transferId', 'tsc.transferId')
      .innerJoin('transferState AS ts', 'tsc.transferStateId', 'tsc.transferStateId')
      .innerJoin('ilp AS ilp', 'transfer.transferId', 'ilp.transferId')
      .select(
        'transfer.*',
        'transfer.currencyId AS currency',
        'ca.name AS payerFsp',
        'da.name AS payeeFsp',
        'tsc.transferStateId AS internalTransferState',
        'ts.enumeration AS transferState',
        'ilp.packet AS ilpPacket',
        'ilp.condition AS condition',
        'ilp.fulfillment AS fulfillment'
      )
      .orderBy('tsc.transferStateChangeId', 'desc')
      .first()

    transferResultList = transferResultList.map(async transferResult => {
      var extensionList = await extensionModel.getByTransferId(transferResult.transferId)
      transferResult.extensionList = extensionList
      transferResult.isTransferReadModel = true
      return transferResult
    })

    return transferResultList
  })
}

const updateTransfer = async (transferId, fields) => {
  return await Db.transfer.update({ transferId: transferId }, fields).catch(err => {
    Logger.info(err)
    throw err
  })
}

const truncateTransfers = async () => {
  return await Db.transfer.truncate()
}

const getById = async (id) => {
  return await Db.transfer.query(async (builder) => {
    var transferResult = builder
      .where({ transferId: id })
      .innerJoin('participant AS ca', 'transfer.payerParticipantId', 'ca.participantId')
      .innerJoin('participant AS da', 'transfer.payeeParticipantId', 'da.participantId')
      .innerJoin('transferStateChange AS tsc', 'transfer.transferId', 'tsc.transferId')
      .innerJoin('ilp AS ilp', 'transfer.transferId', 'ilp.transferId')
      .select(
        'transfer.*',
        'transfer.currencyId AS currency',
        'ca.name AS payerFsp',
        'da.name AS payeeFsp',
        'tsc.transferStateId AS transferState',
        'ilp.packet AS ilpPacket',
        'ilp.condition AS condition',
        'ilp.fulfillment AS fulfillment'
      )
      .orderBy('tsc.transferStateChangeId', 'desc')
      .first()
    const extensionList = await extensionModel.getByTransferId(id)
    transferResult.extensionList = extensionList
    transferResult.isTransferReadModel = true
    return transferResult
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
