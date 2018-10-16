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
const Crypto = require('crypto')
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
    completedDate: Time.getUTCString(new Date(payload.completedTimestamp)),
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
    const knex = await Db.getKnex()
    await knex.transaction(async (trx) => {
      try {
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

const settlementTransfersPrepare = async function (settlementId, transactionTimestamp, enums, trx = null) {
  try {
    const Config = {
      TRANSFER_VALIDITY_SECONDS: 43200
    }

    const knex = await Db.getKnex()
    let t // see (t of settlementTransferList) below

    // Retrieve the list of SETTLED, but not prepared
    let settlementTransferList = await knex('settlementParticipantCurrency AS spc')
      .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'spc.participantCurrencyId')
      .leftJoin('transferDuplicateCheck AS tdc', 'tdc.transferId', 'spc.settlementTransferId')
      .select('spc.*', 'pc.currencyId')
      .where('spc.settlementId', settlementId)
      .whereNotNull('spc.settlementTransferId')
      .whereNull('tdc.transferId')
      .transacting(trx)

    const trxFunction = async (trx, doCommit = true) => {
      try {
        const hashSha256 = Crypto.createHash('sha256')
        let hash = hashSha256.update(String(t.settlementTransferId))
        hash = hashSha256.digest(hash).toString('base64').slice(0, -1) // removing the trailing '=' as per the specification
        // Insert transferDuplicateCheck
        await knex('transferDuplicateCheck')
          .insert({
            transferId: t.settlementTransferId,
            hash,
            createdDate: transactionTimestamp
          })
          .transacting(trx)

        // Insert transfer
        await knex('transfer')
          .insert({
            transferId: t.settlementTransferId,
            amount: Math.abs(t.netAmount),
            currencyId: t.currencyId,
            ilpCondition: 0,
            expirationDate: new Date(+new Date() + 1000 * Number(Config.TRANSFER_VALIDITY_SECONDS)).toISOString().replace(/[TZ]/g, ' ').trim(),
            createdDate: transactionTimestamp
          })
          .transacting(trx)

        // Retrieve participant settlement account
        let {settlementAccountId} = await knex('participantCurrency AS pc1')
          .join('participantCurrency AS pc2', function () {
            this.on('pc2.participantId', 'pc1.participantId')
              .andOn('pc2.currencyId', 'pc1.currencyId')
              .andOn('pc2.ledgerAccountTypeId', enums.ledgerAccountTypes.SETTLEMENT)
              .andOn('pc2.isActive', 1)
          })
          .select('pc2.participantCurrencyId AS settlementAccountId')
          .where('pc1.participantCurrencyId', t.participantCurrencyId)
          .first()
          .transacting(trx)

        let ledgerEntryTypeId
        if (t.netAmount < 0) {
          ledgerEntryTypeId = enums.ledgerEntryTypes.SETTLEMENT_NET_RECIPIENT
        } else if (t.netAmount > 0) {
          ledgerEntryTypeId = enums.ledgerEntryTypes.SETTLEMENT_NET_SENDER
        } else { // t.netAmount === 0
          ledgerEntryTypeId = enums.ledgerEntryTypes.SETTLEMENT_NET_ZERO
        }

        // Insert transferParticipant records
        await knex('transferParticipant')
          .insert({
            transferId: t.settlementTransferId,
            participantCurrencyId: settlementAccountId,
            transferParticipantRoleTypeId: enums.transferParticipantRoleTypes.DFSP_SETTLEMENT_ACCOUNT,
            ledgerEntryTypeId: ledgerEntryTypeId,
            amount: t.netAmount,
            createdDate: transactionTimestamp
          })
          .transacting(trx)
        await knex('transferParticipant')
          .insert({
            transferId: t.settlementTransferId,
            participantCurrencyId: t.participantCurrencyId,
            transferParticipantRoleTypeId: enums.transferParticipantRoleTypes.DFSP_POSITION_ACCOUNT,
            ledgerEntryTypeId: ledgerEntryTypeId,
            amount: -t.netAmount,
            createdDate: transactionTimestamp
          })
          .transacting(trx)

        // Insert transferStateChange
        await knex('transferStateChange')
          .insert({
            transferId: t.settlementTransferId,
            transferStateId: enums.transferStates.RESERVED,
            reason: 'Settlement transfer prepare',
            createdDate: transactionTimestamp
          })
          .transacting(trx)

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

    for (t of settlementTransferList) {
      if (trx) {
        await trxFunction(trx, false)
      } else {
        await knex.transaction(trxFunction)
      }
    }
    return 0
  } catch (err) {
    throw err
  }
}

const settlementTransfersCommit = async function (settlementId, transactionTimestamp, enums, trx = null) {
  try {
    const knex = await Db.getKnex()
    let isLimitExceeded, latestPosition, transferStateChangeId

    let settlementTransferList = await knex('settlementParticipantCurrency AS spc')
      .join('transferStateChange AS tsc1', function () {
        this.on('tsc1.transferId', 'spc.settlementTransferId')
          .andOn('tsc1.transferStateId', knex.raw('?', [enums.transferStates.RESERVED]))
      })
      .leftJoin('transferStateChange AS tsc2', function () {
        this.on('tsc2.transferId', 'spc.settlementTransferId')
          .andOn('tsc2.transferStateId', knex.raw('?', [enums.transferStates.COMMITTED]))
      })
      .leftJoin('transferParticipant AS tp', function () {
        this.on('tp.transferId', 'spc.settlementTransferId')
          .andOn('tp.participantCurrencyId', 'spc.participantCurrencyId')
      })
      .select('tp.transferId', 'tp.participantCurrencyId', 'tp.amount')
      .where('spc.settlementId', settlementId)
      .whereNull('tsc2.transferId')
      .transacting(trx)

    const trxFunction = async (trx, doCommit = true) => {
      try {
        for (let t of settlementTransferList) {
          // Select participantPosition FOR UPDATE
          let {participantPositionId, positionValue, reservedValue} = await knex('participantPosition')
            .select('participantPositionId', 'value AS positionValue', 'reservedValue')
            .where('participantCurrencyId', t.participantCurrencyId)
            .first()
            .transacting(trx)
            .forUpdate()

          // Select participant NET_DEBIT_CAP limit
          let {netDebitCap} = await knex('participantLimit')
            .select('value AS netDebitCap')
            .where('participantCurrencyId', t.participantCurrencyId)
            .andWhere('participantLimitTypeId', enums.participantLimitTypes.NET_DEBIT_CAP)
            .first()
            .transacting(trx)
            .forUpdate()

          isLimitExceeded = netDebitCap - positionValue - reservedValue - t.amount < 0
          latestPosition = positionValue + t.amount

          // Persist latestPosition
          await knex('participantPosition')
            .update('value', latestPosition)
            .where('participantPositionId', participantPositionId)
            .transacting(trx)

          if (isLimitExceeded) {
            await ParticipantFacade.adjustLimits(t.participantCurrencyId, {type: 'NET_DEBIT_CAP', value: netDebitCap + t.amount}, trx)
            // TODO: insert new limit with correct value for startAfterParticipantPositionChangeId (not to be implemented here)
            // TODO: notify DFSP for NDC change (not to be implemented here)
          }

          // Persist transfer state and participant position change
          await knex('transferFulfilment')
            .insert({
              transferFulfilmentId: Uuid(),
              transferId: t.transferId,
              ilpFulfilment: 0,
              completedDate: transactionTimestamp,
              isValid: 1,
              settlementWindowId: null,
              createdDate: transactionTimestamp
            })
            .transacting(trx)

          transferStateChangeId = await knex('transferStateChange')
            .insert({
              transferId: t.transferId,
              transferStateId: enums.transferStates.COMMITTED,
              reason: 'Settlement transfer commit',
              createdDate: transactionTimestamp
            })
            .transacting(trx)

          await knex('participantPositionChange')
            .insert({
              participantPositionId: participantPositionId,
              transferStateChangeId: transferStateChangeId,
              value: latestPosition,
              reservedValue,
              createdDate: transactionTimestamp
            })
            .transacting(trx)

          if (doCommit) {
            await trx.commit
          }
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

const reconciliationTransferPrepare = async function (transactionReferenceId, transactionTimestamp, enums, trx = null) {
  try {

  } catch (err) {
    throw err
  }
}

const reconciliationTransferCommit = async function (transactionReferenceId, transactionTimestamp, enums, trx = null) {
  try {

  } catch (err) {
    throw err
  }
}

const reconciliationTransferAbort = async function (transactionReferenceId, transactionTimestamp, enums, trx = null) {
  try {

  } catch (err) {
    throw err
  }
}

module.exports = {
  getById,
  getAll,
  getTransferInfoToChangePosition,
  saveTransferFulfiled,
  saveTransferPrepared,
  getTransferStateByTransferId,
  timeoutExpireReserved,
  settlementTransfersPrepare,
  settlementTransfersCommit,
  reconciliationTransferPrepare,
  reconciliationTransferCommit,
  reconciliationTransferAbort
}
