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
  try {
    return await Db.transfer.insert(record)
  } catch (err) {
    throw err
  }
}

const getAll = async () => {
  try {
    return await Db.transfer.query(async (builder) => {
      let transferResultList = await builder
        .innerJoin('participant AS ca', 'transfer.payerParticipantId', 'ca.participantId')
        .innerJoin('participant AS da', 'transfer.payeeParticipantId', 'da.participantId')
        .leftJoin('transferStateChange AS tsc', 'transfer.transferId', 'tsc.transferId')
        .leftJoin('transferState AS ts', 'ts.transferStateId', 'tsc.transferStateId')
        .leftJoin('ilp AS ilp', 'transfer.transferId', 'ilp.transferId')
        .select(
          'transfer.*',
          'transfer.currencyId AS currency',
          'ca.name AS payerFsp',
          'da.name AS payeeFsp',
          'tsc.transferStateId AS internalTransferState',
          'tsc.changedDate AS completedTimestamp',
          'ts.enumeration AS transferState',
          'ilp.packet AS ilpPacket',
          'ilp.condition AS condition',
          'ilp.fulfilment AS fulfilment',
          'ilp.ilpId AS ilpId'
        )
        .orderBy('tsc.transferStateChangeId', 'desc')
      for (let transferResult of transferResultList) {
        transferResult.extensionList = await extensionModel.getByTransferId(transferResult.transferId)
        transferResult.isTransferReadModel = true
      }
      return transferResultList
    })
  } catch (err) {
    throw err
  }
}

const updateTransfer = async (transferId, fields) => {
  try {
    return await Db.transfer.update({ transferId: transferId }, fields)
  } catch (err) {
    Logger.info(err)
    throw err
  }
}

const truncateTransfers = async () => {
  try {
    return await Db.transfer.truncate()
  } catch (err) {
    Logger.info(err)
    throw err
  }
}

const destroyByTransferId = async (transfer) => {
  try {
    await Db.transfer.destroy({transferId: transfer.transferId})
  } catch (err) {
    throw new Error(err.message)
  }
}

const getById = async (id) => {
  try {
    return await Db.transfer.query(async (builder) => {
      var transferResult = builder
        .where({'transfer.transferId': id})
        .innerJoin('participant AS ca', 'transfer.payerParticipantId', 'ca.participantId')
        .innerJoin('participant AS da', 'transfer.payeeParticipantId', 'da.participantId')
        .leftJoin('transferStateChange AS tsc', 'transfer.transferId', 'tsc.transferId')
        .leftJoin('ilp AS ilp', 'transfer.transferId', 'ilp.transferId')
        .select(
          'transfer.*',
          'transfer.currencyId AS currency',
          'ca.name AS payerFsp',
          'da.name AS payeeFsp',
          'tsc.transferStateId AS transferState',
          'tsc.changedDate AS completedTimestamp',
          'ilp.packet AS ilpPacket',
          'ilp.condition AS condition',
          'ilp.fulfilment AS fulfilment',
          'ilp.ilpId AS ilpId'
        )
        .orderBy('tsc.transferStateChangeId', 'desc')
        .first()
      transferResult.extensionList = await extensionModel.getByTransferId(id)
      transferResult.isTransferReadModel = true
      return transferResult
    })
  } catch (e) {
    throw e
  }
}

module.exports = {
  findExpired,
  saveTransfer,
  getAll,
  updateTransfer,
  truncateTransfers,
  destroyByTransferId,
  getById
}
