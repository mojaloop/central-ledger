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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * @module src/models/transfer/facade/
 */

const Db = require('../../db')
const Uuid = require('uuid4')
const Enum = require('../../lib/enum')
const TransferExtensionModel = require('./transferExtension')
const ParticipantFacade = require('../participant/facade')
const _ = require('lodash')

const getById = async (id) => {
  try {
    return await Db.transfer.query(async (builder) => {
      let transferResult = await builder
        .where({
          'transfer.transferId': id,
          'tprt1.name': 'PAYER_DFSP', // TODO: refactor to use transferParticipantRoleTypeId
          'tprt2.name': 'PAYEE_DFSP'
        })
        .whereRaw('pc1.currencyId = transfer.currencyId')
        .whereRaw('pc2.currencyId = transfer.currencyId')
        // PAYER
        .innerJoin('transferParticipant AS tp1', 'tp1.transferId', 'transfer.transferId')
        .innerJoin('transferParticipantRoleType AS tprt1', 'tprt1.transferParticipantRoleTypeId', 'tp1.transferParticipantRoleTypeId')
        .innerJoin('participantCurrency AS pc1', 'pc1.participantCurrencyId', 'tp1.participantCurrencyId')
        .innerJoin('participant AS da', 'da.participantId', 'pc1.participantId')
        // PAYEE
        .innerJoin('transferParticipant AS tp2', 'tp2.transferId', 'transfer.transferId')
        .innerJoin('transferParticipantRoleType AS tprt2', 'tprt2.transferParticipantRoleTypeId', 'tp2.transferParticipantRoleTypeId')
        .innerJoin('participantCurrency AS pc2', 'pc2.participantCurrencyId', 'tp2.participantCurrencyId')
        .innerJoin('participant AS ca', 'ca.participantId', 'pc2.participantId')
        // OTHER JOINS
        .innerJoin('ilpPacket AS ilpp', 'ilpp.transferId', 'transfer.transferId')
        .leftJoin('transferStateChange AS tsc', 'tsc.transferId', 'transfer.transferId')
        .leftJoin('transferFulfilment AS tf', 'tf.transferId', 'transfer.transferId')
        .select(
          'transfer.*',
          'transfer.currencyId AS currency',
          'pc1.participantCurrencyId AS payerParticipantCurrencyId',
          'tp1.amount AS payerAmount',
          'da.participantId AS payerParticipantId',
          'da.name AS payerFsp',
          'pc2.participantCurrencyId AS payeeParticipantCurrencyId',
          'tp2.amount AS payeeAmount',
          'ca.participantId AS payeeParticipantId',
          'ca.name AS payeeFsp',
          'tsc.transferStateChangeId',
          'tsc.transferStateId AS transferState',
          'tsc.reason AS reason',
          'tsc.createdDate AS completedTimestamp',
          'ilpp.value AS ilpPacket',
          'transfer.ilpCondition AS condition',
          'tf.ilpFulfilment AS fulfilment'
        )
        .orderBy('tsc.transferStateChangeId', 'desc')
        .first()
      if (transferResult) {
        transferResult.extensionList = await TransferExtensionModel.getByTransferId(id) // TODO: check if this is needed
        transferResult.isTransferReadModel = true
      }
      return transferResult
    })
  } catch (e) {
    throw e
  }
}

const getAll = async () => {
  try {
    return await Db.transfer.query(async (builder) => {
      let transferResultList = await builder
        .where({
          'tprt1.name': 'PAYER_DFSP', // TODO: refactor to use transferParticipantRoleTypeId
          'tprt2.name': 'PAYEE_DFSP'
        })
        .whereRaw('pc1.currencyId = transfer.currencyId')
        .whereRaw('pc2.currencyId = transfer.currencyId')
        // PAYER
        .innerJoin('transferParticipant AS tp1', 'tp1.transferId', 'transfer.transferId')
        .innerJoin('transferParticipantRoleType AS tprt1', 'tprt1.transferParticipantRoleTypeId', 'tp1.transferParticipantRoleTypeId')
        .innerJoin('participantCurrency AS pc1', 'pc1.participantCurrencyId', 'tp1.participantCurrencyId')
        .innerJoin('participant AS da', 'da.participantId', 'pc1.participantId')
        // PAYEE
        .innerJoin('transferParticipant AS tp2', 'tp2.transferId', 'transfer.transferId')
        .innerJoin('transferParticipantRoleType AS tprt2', 'tprt2.transferParticipantRoleTypeId', 'tp2.transferParticipantRoleTypeId')
        .innerJoin('participantCurrency AS pc2', 'pc2.participantCurrencyId', 'tp2.participantCurrencyId')
        .innerJoin('participant AS ca', 'ca.participantId', 'pc2.participantId')
        // OTHER JOINS
        .innerJoin('ilpPacket AS ilpp', 'ilpp.transferId', 'transfer.transferId')
        .leftJoin('transferStateChange AS tsc', 'tsc.transferId', 'transfer.transferId')
        .leftJoin('transferFulfilment AS tf', 'tf.transferId', 'transfer.transferId')
        .select(
          'transfer.*',
          'transfer.currencyId AS currency',
          'pc1.participantCurrencyId AS payerParticipantCurrencyId',
          'tp1.amount AS payerAmount',
          'da.participantId AS payerParticipantId',
          'da.name AS payerFsp',
          'pc2.participantCurrencyId AS payeeParticipantCurrencyId',
          'tp2.amount AS payeeAmount',
          'ca.participantId AS payeeParticipantId',
          'ca.name AS payeeFsp',
          'tsc.transferStateId AS transferState',
          'tsc.reason AS reason',
          'tsc.createdDate AS completedTimestamp',
          'ilpp.value AS ilpPacket',
          'transfer.ilpCondition AS condition',
          'tf.ilpFulfilment AS fulfilment'
        )
        .orderBy('tsc.transferStateChangeId', 'desc')
      for (let transferResult of transferResultList) {
        transferResult.extensionList = await TransferExtensionModel.getByTransferId(transferResult.transferId)
        transferResult.isTransferReadModel = true
      }
      return transferResultList
    })
  } catch (err) {
    throw err
  }
}

const getTransferInfoToChangePosition = async (id, transferParticipantRoleTypeId, ledgerEntryTypeId) => {
  try {
    return await Db.transferParticipant.query(async (builder) => {
      let result = await builder
        .where({
          'transferParticipant.transferId': id,
          'transferParticipant.transferParticipantRoleTypeId': transferParticipantRoleTypeId,
          'transferParticipant.ledgerEntryTypeId': ledgerEntryTypeId
        })
        .innerJoin('transferStateChange AS tsc', 'tsc.transferId', 'transferParticipant.transferId')
        .select(
          'transferParticipant.*',
          'tsc.transferStateId',
          'tsc.reason'
        )
        .orderBy('tsc.transferStateChangeId', 'desc')
        .first()
      return result
    })
  } catch (e) {
    throw e
  }
}

const saveTransferFulfiled = async (transferId, payload, isCommit = true, stateReason = null, hasPassedValidation = true) => {
  const transferFulfilmentId = Uuid() // TODO: should be generated before TransferFulfilmentDuplicateCheck and passed here as parameter
  const state = (hasPassedValidation ? (isCommit ? Enum.TransferState.RECEIVED_FULFIL : Enum.TransferState.REJECTED) : Enum.TransferState.ABORTED)
  const transferFulfilmentRecord = {
    transferFulfilmentId,
    transferId,
    ilpFulfilment: payload.fulfilment,
    completedDate: new Date(payload.completedTimestamp),
    isValid: true,
    createdDate: new Date()
  }
  let transferExtensions = []
  if (payload.extensionList && payload.extensionList.extension) {
    transferExtensions = payload.extensionList.extension.map(ext => {
      return {
        transferId,
        transferFulfilmentId,
        key: ext.key,
        value: ext.value
      }
    })
  }
  const transferStateChangeRecord = {
    transferId,
    transferStateId: state,
    reason: stateReason,
    createdDate: new Date()
  }

  try {
    const knex = await Db.getKnex()
    await knex.transaction(async (trx) => {
      try {
        let fromDateTime = new Date('01-01-1970').toISOString()
        let toDateTime = new Date().toLocaleString()
        let result = await Db.settlementWindow.query(builder => {
          return builder
            .leftJoin('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId')
            .select(
              'settlementWindow.settlementWindowId',
              'swsc.settlementWindowStateId as state',
              'swsc.reason as reason',
              'settlementWindow.createdDate as createdDate',
              'swsc.createdDate as changedDate'
            )
            .whereRaw(`swsc.settlementWindowStateId = "OPEN" AND settlementWindow.createdDate >= '${fromDateTime}' AND settlementWindow.createdDate <= '${toDateTime}'`)
            .orderBy('changedDate', 'desc')
        })
        transferFulfilmentRecord.settlementWindowId = result[0].settlementWindowId
        await knex('transferFulfilment').transacting(trx).insert(transferFulfilmentRecord)
        for (let transferExtension of transferExtensions) {
          await knex('transferExtension').transacting(trx).insert(transferExtension)
        }
        await knex('transferStateChange').transacting(trx).insert(transferStateChangeRecord)
        await trx.commit
      } catch (err) {
        await trx.rollback
        throw err
      }
    }).catch((err) => {
      throw err
    })
    return {
      saveTransferFulfiledExecuted: true,
      transferFulfilmentRecord,
      transferStateChangeRecord,
      transferExtensions
    }
  } catch (e) {
    throw e
  }
}

const saveTransferPrepared = async (payload, stateReason = null, hasPassedValidation = true) => {
  try {
    const participants = []
    const names = [payload.payeeFsp, payload.payerFsp]

    for (let name of names) {
      const participant = await ParticipantFacade.getByNameAndCurrency(name, payload.amount.currency)
      if (participant) {
        participants.push(participant)
      } else {
        throw new Error('Invalid FSP name')
      }
    }

    const participantCurrencyIds = await _.reduce(participants, (m, acct) =>
      _.set(m, acct.name, acct.participantCurrencyId), {})

    const transferRecord = {
      transferId: payload.transferId,
      amount: payload.amount.amount,
      currencyId: payload.amount.currency,
      ilpCondition: payload.condition,
      expirationDate: new Date(payload.expiration)
    }

    const ilpPacketRecord = {
      transferId: payload.transferId,
      value: payload.ilpPacket
    }

    const state = ((hasPassedValidation) ? Enum.TransferState.RECEIVED_PREPARE : Enum.TransferState.ABORTED)

    const transferStateChangeRecord = {
      transferId: payload.transferId,
      transferStateId: state,
      reason: stateReason,
      createdDate: new Date()
    }

    const payerTransferParticipantRecord = {
      transferId: payload.transferId,
      participantCurrencyId: participantCurrencyIds[payload.payerFsp],
      transferParticipantRoleTypeId: Enum.TransferParticipantRoleType.PAYER_DFSP,
      ledgerEntryTypeId: Enum.LedgerEntryType.PRINCIPLE_VALUE,
      amount: payload.amount.amount
    }

    const payeeTransferParticipantRecord = {
      transferId: payload.transferId,
      participantCurrencyId: participantCurrencyIds[payload.payeeFsp],
      transferParticipantRoleTypeId: Enum.TransferParticipantRoleType.PAYEE_DFSP,
      ledgerEntryTypeId: Enum.LedgerEntryType.PRINCIPLE_VALUE,
      amount: payload.amount.amount
    }

    const knex = await Db.getKnex()
    return await knex.transaction(async (trx) => {
      try {
        await knex('transfer').transacting(trx).insert(transferRecord)
        await knex('transferParticipant').transacting(trx).insert(payerTransferParticipantRecord)
        await knex('transferParticipant').transacting(trx).insert(payeeTransferParticipantRecord)
        payerTransferParticipantRecord.name = payload.payerFsp
        payeeTransferParticipantRecord.name = payload.payeeFsp
        let transferExtensionsRecordList = []
        if (payload.extensionList && payload.extensionList.extension) {
          transferExtensionsRecordList = payload.extensionList.extension.map(ext => {
            return {
              transferId: payload.transferId,
              key: ext.key,
              value: ext.value
            }
          })
          await knex.batchInsert('transferExtension', transferExtensionsRecordList).transacting(trx)
        }
        await knex('ilpPacket').transacting(trx).insert(ilpPacketRecord)
        await knex('transferStateChange').transacting(trx).insert(transferStateChangeRecord)
        await trx.commit
      } catch (err) {
        await trx.rollback
        throw err
      }
    })
  } catch (e) {
    throw e
  }
}

/**
 * @function GetTransferStateByTransferId
 *
 * @async
 * @description This will get the latest transfer state change name for a given transfer id
 *
 * @param {string} id - the transfer id
 *
 * @returns {Object} - Returns the details of transfer state change if successful, or throws an error if failed
 * Example:
 * ```
 * {
 *    transferStateChangeId: 1,
 *    transferId: '9136780b-37e2-457c-8c05-f15dbb033b11',
 *    transferStateId: 'COMMITTED',
 *    reason: null,
 *    createdDate: '2018-08-17 09:46:21',
 *    enumeration: 'COMMITTED'
 * }
 * ```
 */

const getTransferStateByTransferId = async (id) => {
  try {
    return await Db.transferStateChange.query(async (builder) => {
      let result = builder
        .innerJoin('transferState AS ts', 'ts.transferStateId', 'transferStateChange.transferStateId')
        .where({
          'transferStateChange.transferId': id,
          'ts.isActive': 1
        })
        .select('transferStateChange.*', 'ts.enumeration')
        .orderBy('transferStateChangeId', 'desc')
        .first()
      return result
    })
  } catch (err) {
    throw err
  }
}

const timeoutExpireReserved = async (segmentId, intervalMin, intervalMax) => {
  try {
    let transactionTimestamp = new Date()
    const knex = await Db.getKnex()
    await knex.transaction(async (trx) => {
      try {
        await knex.from(knex.raw('transferTimeout (transferId, expirationDate)')).transacting(trx)
          .insert(function () {
            this.from('transfer AS t')
              .innerJoin(knex('transferStateChange')
                .select('transferId')
                .max('transferStateChangeId AS maxTransferStateChangeId')
                .where('transferStateChangeId', '>', intervalMin)
                .andWhere('transferStateChangeId', '<=', intervalMax)
                .groupBy('transferId').as('ts'), 'ts.transferId', 't.transferId'
              )
              .innerJoin('transferStateChange AS tsc', 'tsc.transferStateChangeId', 'ts.maxTransferStateChangeId')
              .whereIn('tsc.transferStateId', [`${Enum.TransferState.RECEIVED_PREPARE}`, `${Enum.TransferState.RESERVED}`])
              .select('t.transferId', 't.expirationDate')
          })// .toSQL().sql
        // console.log('SQL: ' + q)

        await knex.from(knex.raw('transferStateChange (transferId, transferStateId, reason)')).transacting(trx)
          .insert(function () {
            this.from('transferTimeout AS tt')
              .innerJoin(knex('transferStateChange AS tsc1')
                .select('tsc1.transferId')
                .max('tsc1.transferStateChangeId AS maxTransferStateChangeId')
                .innerJoin('transferTimeout AS tt1', 'tt1.transferId', 'tsc1.transferId')
                .groupBy('tsc1.transferId').as('ts'), 'ts.transferId', 'tt.transferId'
              )
              .innerJoin('transferStateChange AS tsc', 'tsc.transferStateChangeId', 'ts.maxTransferStateChangeId')
              .where('tt.expirationDate', '<', transactionTimestamp)
              .andWhere('tsc.transferStateId', `${Enum.TransferState.RECEIVED_PREPARE}`)
              .select('tt.transferId', knex.raw('?', Enum.TransferState.EXPIRED_PREPARED), knex.raw('?', 'Aborted by Timeout Handler'))
          })// .toSQL().sql
        // console.log('SQL: ' + q)

        await knex.from(knex.raw('transferStateChange (transferId, transferStateId, reason)')).transacting(trx)
          .insert(function () {
            this.from('transferTimeout AS tt')
              .innerJoin(knex('transferStateChange AS tsc1')
                .select('tsc1.transferId')
                .max('tsc1.transferStateChangeId AS maxTransferStateChangeId')
                .innerJoin('transferTimeout AS tt1', 'tt1.transferId', 'tsc1.transferId')
                .groupBy('tsc1.transferId').as('ts'), 'ts.transferId', 'tt.transferId'
              )
              .innerJoin('transferStateChange AS tsc', 'tsc.transferStateChangeId', 'ts.maxTransferStateChangeId')
              .where('tt.expirationDate', '<', transactionTimestamp)
              .andWhere('tsc.transferStateId', `${Enum.TransferState.RESERVED}`)
              .select('tt.transferId', knex.raw('?', Enum.TransferState.RESERVED_TIMEOUT), knex.raw('?', 'Marked for expiration by Timeout Handler'))
          })// .toSQL().sql
        // console.log('SQL: ' + q)

        if (segmentId === 0) {
          const segment = {
            segmentType: 'timeout',
            enumeration: 0,
            tableName: 'transferStateChange',
            value: intervalMax
          }
          await knex('segment').transacting(trx).insert(segment)
        } else {
          await knex('segment').transacting(trx).where({segmentId}).update({value: intervalMax})
        }
        await trx.commit
      } catch (err) {
        await trx.rollback
        throw err
      }
    }).catch((err) => {
      throw err
    })

    let result = knex('transferTimeout AS tt')
      .innerJoin(knex('transferStateChange AS tsc1')
        .select('tsc1.transferId')
        .max('tsc1.transferStateChangeId AS maxTransferStateChangeId')
        .innerJoin('transferTimeout AS tt1', 'tt1.transferId', 'tsc1.transferId')
        .groupBy('tsc1.transferId').as('ts'), 'ts.transferId', 'tt.transferId'
      )
      .innerJoin('transferStateChange AS tsc', 'tsc.transferStateChangeId', 'ts.maxTransferStateChangeId')
      .innerJoin('transferParticipant AS tp1', function () {
        this.on('tp1.transferId', 'tt.transferId')
          .andOn('tp1.transferParticipantRoleTypeId', Enum.TransferParticipantRoleType.PAYER_DFSP)
          .andOn('tp1.ledgerEntryTypeId', Enum.LedgerEntryType.PRINCIPLE_VALUE)
      })
      .innerJoin('transferParticipant AS tp2', function () {
        this.on('tp2.transferId', 'tt.transferId')
          .andOn('tp2.transferParticipantRoleTypeId', Enum.TransferParticipantRoleType.PAYEE_DFSP)
          .andOn('tp2.ledgerEntryTypeId', Enum.LedgerEntryType.PRINCIPLE_VALUE)
      })
      .innerJoin('participantCurrency AS pc1', 'pc1.participantCurrencyId', 'tp1.participantCurrencyId')
      .innerJoin('participant AS p1', 'p1.participantId', 'pc1.participantId')

      .innerJoin('participantCurrency AS pc2', 'pc2.participantCurrencyId', 'tp2.participantCurrencyId')
      .innerJoin('participant AS p2', 'p2.participantId', 'pc2.participantId')

      .where('tt.expirationDate', '<', transactionTimestamp)
      .select('tt.*', 'tsc.transferStateId', 'tp1.participantCurrencyId AS payerParticipantId',
        'p1.name AS payerFsp', 'p2.name AS payeeFsp', 'tp2.participantCurrencyId AS payeeParticipantId')
    return result
  } catch (e) {
    throw e
  }
}

module.exports = {
  getById,
  getAll,
  getTransferInfoToChangePosition,
  saveTransferFulfiled,
  saveTransferPrepared,
  getTransferStateByTransferId,
  timeoutExpireReserved
}
