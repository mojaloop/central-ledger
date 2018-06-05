/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Georgi Georgiev <georgi.georgiev@modusbox.com>e
 --------------
 ******/

'use strict'

const Db = require('../../../db')
const extensionModel = require('../../../models/extensions')
const Logger = require('@mojaloop/central-services-shared').Logger

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
  saveTransfer,
  getAll,
  updateTransfer,
  truncateTransfers,
  destroyByTransferId,
  getById
}
