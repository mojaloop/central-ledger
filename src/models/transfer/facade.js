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
const Time = require('../../lib/time')
const Config = require('../../lib/config')
const _ = require('lodash')

const errorPayeeGeneric = 5000
const intervalMinPayeeError = errorPayeeGeneric
const intervalMaxPayeeError = 5500

const getById = async (id) => {
  try {
    /** @namespace Db.transfer **/
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
        .leftJoin('transferState AS ts', 'ts.transferStateId', 'tsc.transferStateId')
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
          'ts.enumeration as transferStateEnumeration',
          'ts.description as transferStateDescription',
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

const getByIdLight = async (id) => {
  try {
    /** @namespace Db.transfer **/
    return await Db.transfer.query(async (builder) => {
      let transferResult = await builder
        .where({ 'transfer.transferId': id })
        .leftJoin('ilpPacket AS ilpp', 'ilpp.transferId', 'transfer.transferId')
        .leftJoin('transferStateChange AS tsc', 'tsc.transferId', 'transfer.transferId')
        .leftJoin('transferState AS ts', 'ts.transferStateId', 'tsc.transferStateId')
        .leftJoin('transferFulfilment AS tf', 'tf.transferId', 'transfer.transferId')
        .select(
          'transfer.*',
          'transfer.currencyId AS currency',
          'tsc.transferStateChangeId',
          'tsc.transferStateId AS transferState',
          'ts.enumeration AS transferStateEnumeration',
          'ts.description as transferStateDescription',
          'tsc.reason AS reason',
          'tsc.createdDate AS completedTimestamp',
          'ilpp.value AS ilpPacket',
          'transfer.ilpCondition AS condition',
          'tf.ilpFulfilment AS fulfilment',
          'tf.transferFulfilmentId'
        )
        .orderBy('tsc.transferStateChangeId', 'desc')
        .first()
      if (transferResult) {
        if (!transferResult.fulfilment) {
          transferResult.extensionList = await TransferExtensionModel.getByTransferId(id)
        } else {
          transferResult.extensionList = await TransferExtensionModel.getByTransferFulfilmentId(transferResult.transferFulfilmentId)
        }
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
    /** @namespace Db.transferParticipant **/
    return await Db.transferParticipant.query(async builder => {
      return builder
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
    })
  } catch (e) {
    throw e
  }
}

const saveTransferFulfilled = async (transferId, payload, isCommit = true, stateReason = null, hasPassedValidation = true) => {
  const transferFulfilmentId = Uuid() // TODO: should be generated before TransferFulfilmentDuplicateCheck and passed here as parameter
  const state = (hasPassedValidation ? (isCommit ? Enum.TransferState.RECEIVED_FULFIL : Enum.TransferState.RECEIVED_REJECT) : Enum.TransferState.ABORTED_REJECTED)
  const completedTimestamp = (payload.completedTimestamp && new Date(payload.completedTimestamp)) || new Date()
  const transferFulfilmentRecord = {
    transferFulfilmentId,
    transferId,
    ilpFulfilment: payload.fulfilment,
    completedDate: Time.getUTCString(completedTimestamp),
    isValid: true,
    createdDate: Time.getUTCString(new Date())
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
    createdDate: Time.getUTCString(new Date())
  }

  try {
    /** @namespace Db.getKnex **/
    const knex = await Db.getKnex()
    await knex.transaction(async (trx) => {
      try {
        /** @namespace Db.settlementWindow **/
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
            .where('swsc.settlementWindowStateId', 'OPEN')
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
      saveTransferFulfilledExecuted: true,
      transferFulfilmentRecord,
      transferStateChangeRecord,
      transferExtensions
    }
  } catch (e) {
    throw e
  }
}

/**
 * @function saveTransferAborted
 *
 * @async
 * @description This will set transfer state to RECEIVED_ERROR and record extensions if provided
 *
 * @param {string} transfer - transfer id
 * @param {object} payload - message payload containing errorInformation and extensions
 *
 * @returns {Object} - Returns details for the affected db records
 */

const saveTransferAborted = async (transferId, payload) => {
  let errorCode
  let errorDescription
  let transferErrorRecord

  const transactionTimestamp = Time.getUTCString(new Date())

  if (payload.errorInformation.errorCode &&
    payload.errorInformation.errorCode > intervalMinPayeeError &&
    payload.errorInformation.errorCode < intervalMaxPayeeError) {
    errorCode = payload.errorInformation.errorCode
  } else {
    errorCode = errorPayeeGeneric
  }
  errorDescription = payload.errorInformation.errorDescription

  const transferStateChangeRecord = {
    transferId,
    transferStateId: Enum.TransferState.RECEIVED_ERROR,
    createdDate: transactionTimestamp,
    reason: errorDescription
  }

  let transferExtensions = []
  if (payload.errorInformation.extensionList && payload.errorInformation.extensionList.extension) {
    transferExtensions = payload.errorInformation.extensionList.extension.map(ext => {
      return {
        transferId,
        key: ext.key,
        value: ext.value
      }
    })
  }

  try {
    /** @namespace Db.getKnex **/
    const knex = await Db.getKnex()
    await knex.transaction(async (trx) => {
      try {
        // insert transfer state change record and retrieve inserted identity
        await knex('transferStateChange').transacting(trx).insert(transferStateChangeRecord)
        const insertedTransferStateChange = await knex('transferStateChange').transacting(trx)
          .where({ transferId: transferStateChangeRecord.transferId })
          .forUpdate().first().orderBy('transferStateChangeId', 'desc')
        transferStateChangeRecord.transferStateChangeId = insertedTransferStateChange.transferStateChangeId

        // insert transfer error
        transferErrorRecord = {
          transferStateChangeId: insertedTransferStateChange.transferStateChangeId,
          errorCode,
          errorDescription,
          createdDate: transactionTimestamp
        }
        await knex('transferError').transacting(trx).insert(transferErrorRecord)

        // insert transfer extensions if provided
        if (transferExtensions.length > 0) {
          const insertedTransferError = await knex('transferError').transacting(trx)
            .where({ transferStateChangeId: insertedTransferStateChange.transferStateChangeId })
            .first().orderBy('transferErrorId', 'desc')
          for (let transferExtension of transferExtensions) {
            transferExtension.transferErrorId = insertedTransferError.transferErrorId
            await knex('transferExtension').transacting(trx).insert(transferExtension)
          }
        }
        await trx.commit
      } catch (err) {
        await trx.rollback
        throw err
      }
    }).catch((err) => {
      throw err
    })
    return {
      saveTransferAbortedExecuted: true,
      transferStateChangeRecord,
      transferErrorRecord,
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
      const participant = await ParticipantFacade.getByNameAndCurrency(name, payload.amount.currency, Enum.LedgerAccountType.POSITION)
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
      expirationDate: Time.getUTCString(new Date(payload.expiration))
    }

    const ilpPacketRecord = {
      transferId: payload.transferId,
      value: payload.ilpPacket
    }

    const state = ((hasPassedValidation) ? Enum.TransferState.RECEIVED_PREPARE : Enum.TransferState.INVALID)

    const transferStateChangeRecord = {
      transferId: payload.transferId,
      transferStateId: state,
      reason: stateReason,
      createdDate: Time.getUTCString(new Date())
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
      amount: -payload.amount.amount
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
    /** @namespace Db.transferStateChange **/
    return await Db.transferStateChange.query(async (builder) => {
      return builder
        .innerJoin('transferState AS ts', 'ts.transferStateId', 'transferStateChange.transferStateId')
        .where({
          'transferStateChange.transferId': id,
          'ts.isActive': 1
        })
        .select('transferStateChange.*', 'ts.enumeration')
        .orderBy('transferStateChangeId', 'desc')
        .first()
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
              .leftJoin('transferTimeout AS tt', 'tt.transferId', 't.transferId')
              .whereNull('tt.transferId')
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
          await knex('segment').transacting(trx).where({ segmentId }).update({ value: intervalMax })
        }
        await trx.commit
      } catch (err) {
        await trx.rollback
        throw err
      }
    }).catch((err) => {
      throw err
    })

    return knex('transferTimeout AS tt')
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
  } catch (e) {
    throw e
  }
}

const transferStateAndPositionUpdate = async function (param1, enums, trx = null) {
  try {
    const knex = await Db.getKnex()

    const trxFunction = async (trx, doCommit = true) => {
      let info, transferStateChangeId
      try {
        info = await knex('transfer AS t')
          .join('transferParticipant AS dr', function () {
            this.on('dr.transferId', 't.transferId')
              .andOn('dr.amount', '>', 0)
          })
          .join('participantCurrency AS drpc', 'drpc.participantCurrencyId', 'dr.participantCurrencyId')
          .join('participantPosition AS drp', 'drp.participantCurrencyId', 'dr.participantCurrencyId')
          .join('transferParticipant AS cr', function () {
            this.on('cr.transferId', 't.transferId')
              .andOn('cr.amount', '<', 0)
          })
          .join('participantCurrency AS crpc', 'crpc.participantCurrencyId', 'dr.participantCurrencyId')
          .join('participantPosition AS crp', 'crp.participantCurrencyId', 'cr.participantCurrencyId')
          .join('transferStateChange AS tsc', 'tsc.transferId', 't.transferId')
          .where('t.transferId', param1.transferId)
          .whereIn('drpc.ledgerAccountTypeId', [enums.ledgerAccountType.POSITION, enums.ledgerAccountType.SETTLEMENT,
            enums.ledgerAccountType.HUB_RECONCILIATION, enums.ledgerAccountType.HUB_MULTILATERAL_SETTLEMENT])
          .whereIn('crpc.ledgerAccountTypeId', [enums.ledgerAccountType.POSITION, enums.ledgerAccountType.SETTLEMENT,
            enums.ledgerAccountType.HUB_RECONCILIATION, enums.ledgerAccountType.HUB_MULTILATERAL_SETTLEMENT])
          .select('dr.participantCurrencyId AS drAccountId', 'dr.amount AS drAmount', 'drp.participantPositionId AS drPositionId',
            'drp.value AS drPositionValue', 'drp.reservedValue AS drReservedValue', 'cr.participantCurrencyId AS crAccountId',
            'cr.amount AS crAmount', 'crp.participantPositionId AS crPositionId', 'crp.value AS crPositionValue',
            'crp.reservedValue AS crReservedValue', 'tsc.transferStateId', 'drpc.ledgerAccountTypeId', 'crpc.ledgerAccountTypeId')
          .orderBy('tsc.transferStateChangeId', 'desc')
          .first()
          .transacting(trx)

        if (param1.transferStateId === enums.transferState.COMMITTED) {
          await knex('transferStateChange')
            .insert({
              transferId: param1.transferId,
              transferStateId: enums.transferState.RECEIVED_FULFIL,
              reason: param1.reason,
              createdDate: param1.createdDate
            })
            .transacting(trx)
        } else if (param1.transferStateId === enums.transferState.ABORTED_REJECTED) {
          await knex('transferStateChange')
            .insert({
              transferId: param1.transferId,
              transferStateId: enums.transferState.RECEIVED_REJECT,
              reason: param1.reason,
              createdDate: param1.createdDate
            })
            .transacting(trx)
        }
        transferStateChangeId = await knex('transferStateChange')
          .insert({
            transferId: param1.transferId,
            transferStateId: param1.transferStateId,
            reason: param1.reason,
            createdDate: param1.createdDate
          })
          .transacting(trx)

        if (param1.drUpdated === true) {
          if (param1.transferStateId === 'ABORTED_REJECTED') {
            info.drAmount = -info.drAmount
          }
          await knex('participantPosition')
            .update('value', info.drPositionValue + info.drAmount)
            .where('participantPositionId', info.drPositionId)
            .transacting(trx)

          await knex('participantPositionChange')
            .insert({
              participantPositionId: info.drPositionId,
              transferStateChangeId: transferStateChangeId,
              value: info.drPositionValue + info.drAmount,
              reservedValue: info.drReservedValue,
              createdDate: param1.createdDate
            })
            .transacting(trx)
        }

        if (param1.crUpdated === true) {
          if (param1.transferStateId === 'ABORTED_REJECTED') {
            info.crAmount = -info.crAmount
          }
          await knex('participantPosition')
            .update('value', info.crPositionValue + info.crAmount)
            .where('participantPositionId', info.crPositionId)
            .transacting(trx)

          await knex('participantPositionChange')
            .insert({
              participantPositionId: info.crPositionId,
              transferStateChangeId: transferStateChangeId,
              value: info.crPositionValue + info.crAmount,
              reservedValue: info.crReservedValue,
              createdDate: param1.createdDate
            })
            .transacting(trx)
        }

        if (doCommit) {
          await trx.commit
        }
      } catch (err) {
        if (doCommit) {
          await trx.rollback
        }
        throw err
      }
      return {
        transferStateChangeId,
        drPositionValue: info.drPositionValue + info.drAmount,
        crPositionValue: info.crPositionValue + info.crAmount
      }
    }

    if (trx) {
      return await trxFunction(trx, false)
    } else {
      return await knex.transaction(trxFunction)
    }
  } catch (err) {
    throw err
  }
}

const reconciliationTransferPrepare = async function (payload, transactionTimestamp, enums, trx = null) {
  try {
    const knex = await Db.getKnex()

    const trxFunction = async (trx, doCommit = true) => {
      try {
        // transferDuplicateCheck check and insert is done prior to calling the prepare
        // see admin/handler.js :: transfer -> TransferService.validateDuplicateHash

        // Insert transfer
        await knex('transfer')
          .insert({
            transferId: payload.transferId,
            amount: payload.amount.amount,
            currencyId: payload.amount.currency,
            ilpCondition: 0,
            expirationDate: Time.getUTCString(new Date(+new Date() +
              1000 * Number(Config.INTERNAL_TRANSFER_VALIDITY_SECONDS))),
            createdDate: transactionTimestamp
          })
          .transacting(trx)

        // Retrieve hub reconciliation account for the specified currency
        let { reconciliationAccountId } = await knex('participantCurrency')
          .select('participantCurrencyId AS reconciliationAccountId')
          .where('participantId', Config.HUB_ID)
          .andWhere('currencyId', payload.amount.currency)
          .first()
          .transacting(trx)

        let ledgerEntryTypeId, amount
        if (payload.action === Enum.adminTransferAction.RECORD_FUNDS_IN) {
          ledgerEntryTypeId = enums.ledgerEntryType.RECORD_FUNDS_IN
          amount = payload.amount.amount
        } else if (payload.action === Enum.adminTransferAction.RECORD_FUNDS_OUT_PREPARE_RESERVE) {
          ledgerEntryTypeId = enums.ledgerEntryType.RECORD_FUNDS_OUT
          amount = -payload.amount.amount
        } else {
          throw new Error('Action not allowed for reconciliationTransferPrepare')
        }

        // Insert transferParticipant records
        await knex('transferParticipant')
          .insert({
            transferId: payload.transferId,
            participantCurrencyId: reconciliationAccountId,
            transferParticipantRoleTypeId: enums.transferParticipantRoleType.HUB,
            ledgerEntryTypeId: ledgerEntryTypeId,
            amount: amount,
            createdDate: transactionTimestamp
          })
          .transacting(trx)
        await knex('transferParticipant')
          .insert({
            transferId: payload.transferId,
            participantCurrencyId: payload.participantCurrencyId,
            transferParticipantRoleTypeId: enums.transferParticipantRoleType.DFSP_SETTLEMENT,
            ledgerEntryTypeId: ledgerEntryTypeId,
            amount: -amount,
            createdDate: transactionTimestamp
          })
          .transacting(trx)

        await knex('transferStateChange')
          .insert({
            transferId: payload.transferId,
            transferStateId: enums.transferState.RECEIVED_PREPARE,
            reason: payload.reason,
            createdDate: transactionTimestamp
          })
          .transacting(trx)

        // Save transaction reference and transfer extensions
        let transferExtensions = []
        transferExtensions.push({
          transferId: payload.transferId,
          key: 'externalReference',
          value: payload.externalReference,
          createdDate: transactionTimestamp
        })
        if (payload.extensionList && payload.extensionList.extension) {
          transferExtensions = transferExtensions.concat(
            payload.extensionList.extension.map(ext => {
              return {
                transferId: payload.transferId,
                key: ext.key,
                value: ext.value,
                createdDate: transactionTimestamp
              }
            })
          )
        }
        for (let transferExtension of transferExtensions) {
          await knex('transferExtension').insert(transferExtension).transacting(trx)
        }

        if (doCommit) {
          await trx.commit
        }
      } catch (err) {
        if (doCommit) {
          await trx.rollback
        }
        throw err
      }
    }

    if (trx) {
      await trxFunction(trx, false)
    } else {
      await knex.transaction(trxFunction)
    }
    return 0
  } catch (err) {
    throw err
  }
}

const reconciliationTransferReserve = async function (payload, transactionTimestamp, enums, trx = null) {
  try {
    const knex = await Db.getKnex()

    const trxFunction = async (trx, doCommit = true) => {
      try {
        let param1 = {
          transferId: payload.transferId,
          transferStateId: enums.transferState.RESERVED,
          reason: payload.reason,
          createdDate: transactionTimestamp,
          drUpdated: true,
          crUpdated: false
        }
        let positionResult = await TransferFacade.transferStateAndPositionUpdate(param1, enums, trx)

        if (payload.action === Enum.adminTransferAction.RECORD_FUNDS_OUT_PREPARE_RESERVE &&
          positionResult.drPositionValue > 0) {
          payload.reason = 'Aborted due to insufficient funds'
          payload.action = Enum.adminTransferAction.RECORD_FUNDS_OUT_ABORT
          await TransferFacade.reconciliationTransferAbort(payload, transactionTimestamp, enums, trx)
        }

        if (doCommit) {
          await trx.commit
        }
      } catch (err) {
        if (doCommit) {
          await trx.rollback
        }
        throw err
      }
    }

    if (trx) {
      await trxFunction(trx, false)
    } else {
      await knex.transaction(trxFunction)
    }
    return 0
  } catch (err) {
    throw err
  }
}

const reconciliationTransferCommit = async function (payload, transactionTimestamp, enums, trx = null) {
  try {
    const knex = await Db.getKnex()

    const trxFunction = async (trx, doCommit = true) => {
      try {
        // Persist transfer state and participant position change
        await knex('transferFulfilment')
          .insert({
            transferFulfilmentId: Uuid(),
            transferId: payload.transferId,
            ilpFulfilment: 0,
            completedDate: transactionTimestamp,
            isValid: 1,
            settlementWindowId: null,
            createdDate: transactionTimestamp
          })
          .transacting(trx)

        if (payload.action === Enum.adminTransferAction.RECORD_FUNDS_IN ||
          payload.action === Enum.adminTransferAction.RECORD_FUNDS_OUT_COMMIT) {
          let param1 = {
            transferId: payload.transferId,
            transferStateId: enums.transferState.COMMITTED,
            reason: payload.reason,
            createdDate: transactionTimestamp,
            drUpdated: false,
            crUpdated: true
          }
          await TransferFacade.transferStateAndPositionUpdate(param1, enums, trx)
        } else {
          throw new Error('Action not allowed for reconciliationTransferCommit')
        }

        if (doCommit) {
          await trx.commit
        }
      } catch (err) {
        if (doCommit) {
          await trx.rollback
        }
        throw err
      }
    }

    if (trx) {
      await trxFunction(trx, false)
    } else {
      await knex.transaction(trxFunction)
    }
    return 0
  } catch (err) {
    throw err
  }
}

const reconciliationTransferAbort = async function (payload, transactionTimestamp, enums, trx = null) {
  try {
    const knex = await Db.getKnex()

    const trxFunction = async (trx, doCommit = true) => {
      try {
        // Persist transfer state and participant position change
        await knex('transferFulfilment')
          .insert({
            transferFulfilmentId: Uuid(),
            transferId: payload.transferId,
            ilpFulfilment: 0,
            completedDate: transactionTimestamp,
            isValid: 1,
            settlementWindowId: null,
            createdDate: transactionTimestamp
          })
          .transacting(trx)

        if (payload.action === Enum.adminTransferAction.RECORD_FUNDS_OUT_ABORT) {
          let param1 = {
            transferId: payload.transferId,
            transferStateId: enums.transferState.ABORTED_REJECTED,
            reason: payload.reason,
            createdDate: transactionTimestamp,
            drUpdated: true,
            crUpdated: false
          }
          await TransferFacade.transferStateAndPositionUpdate(param1, enums, trx)
        } else {
          throw new Error('Action not allowed for reconciliationTransferAbort')
        }

        if (doCommit) {
          await trx.commit
        }
      } catch (err) {
        if (doCommit) {
          await trx.rollback
        }
        throw err
      }
    }

    if (trx) {
      await trxFunction(trx, false)
    } else {
      await knex.transaction(trxFunction)
    }
    return 0
  } catch (err) {
    throw err
  }
}

const getTransferParticipant = async (participantName, transferId) => {
  try {
    return Db.participant.query(async (builder) => {
      return builder
        .where({
          'participant.name': participantName,
          'tp.transferId': transferId,
          'participant.isActive': 1,
          'pc.isActive': 1
        })
        .innerJoin('participantCurrency AS pc', 'pc.participantId', 'participant.participantId')
        .innerJoin('transferParticipant AS tp', 'tp.participantCurrencyId', 'pc.participantCurrencyId')
        .select(
          'tp.*'
        )
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

const TransferFacade = {
  getById,
  getByIdLight,
  getAll,
  getTransferInfoToChangePosition,
  saveTransferFulfilled: saveTransferFulfilled,
  saveTransferAborted,
  saveTransferPrepared,
  getTransferStateByTransferId,
  timeoutExpireReserved,
  transferStateAndPositionUpdate,
  reconciliationTransferPrepare,
  reconciliationTransferReserve,
  reconciliationTransferCommit,
  reconciliationTransferAbort,
  getTransferParticipant
}

module.exports = TransferFacade
