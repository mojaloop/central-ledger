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

const Db = require('../../lib/db')
const Enum = require('@mojaloop/central-services-shared').Enum
const TransferEventAction = Enum.Events.Event.Action
const TransferInternalState = Enum.Transfers.TransferInternalState
const TransferExtensionModel = require('./transferExtension')
const ParticipantFacade = require('../participant/facade')
const Time = require('@mojaloop/central-services-shared').Util.Time
const MLNumber = require('@mojaloop/ml-number')
const Config = require('../../lib/config')
const _ = require('lodash')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Logger = require('@mojaloop/central-services-logger')
const Metrics = require('@mojaloop/central-services-metrics')

// Alphabetically ordered list of error texts used below
const UnsupportedActionText = 'Unsupported action'

const getById = async (id) => {
  try {
    /** @namespace Db.transfer **/
    return await Db.from('transfer').query(async (builder) => {
      const transferResult = await builder
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
        .leftJoin('transferError as te', 'te.transferId', 'transfer.transferId') // currently transferError.transferId is PK ensuring one error per transferId
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
          'tf.ilpFulfilment AS fulfilment',
          'te.errorCode',
          'te.errorDescription'
        )
        .orderBy('tsc.transferStateChangeId', 'desc')
        .first()
      if (transferResult) {
        transferResult.extensionList = await TransferExtensionModel.getByTransferId(id) // TODO: check if this is needed
        if (transferResult.errorCode && transferResult.transferStateEnumeration === Enum.Transfers.TransferState.ABORTED) {
          if (!transferResult.extensionList) transferResult.extensionList = []
          transferResult.extensionList.push({
            key: 'cause',
            value: `${transferResult.errorCode}: ${transferResult.errorDescription}`.substr(0, 128)
          })
        }
        transferResult.isTransferReadModel = true
      }
      return transferResult
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getByIdLight = async (id) => {
  try {
    /** @namespace Db.transfer **/
    return await Db.from('transfer').query(async (builder) => {
      const transferResult = await builder
        .where({ 'transfer.transferId': id })
        .leftJoin('ilpPacket AS ilpp', 'ilpp.transferId', 'transfer.transferId')
        .leftJoin('transferStateChange AS tsc', 'tsc.transferId', 'transfer.transferId')
        .leftJoin('transferState AS ts', 'ts.transferStateId', 'tsc.transferStateId')
        .leftJoin('transferFulfilment AS tf', 'tf.transferId', 'transfer.transferId')
        .leftJoin('transferError as te', 'te.transferId', 'transfer.transferId') // currently transferError.transferId is PK ensuring one error per transferId
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
          'te.errorCode',
          'te.errorDescription'
        )
        .orderBy('tsc.transferStateChangeId', 'desc')
        .first()
      if (transferResult) {
        if (!transferResult.fulfilment) {
          transferResult.extensionList = await TransferExtensionModel.getByTransferId(id)
        } else {
          const isFulfilment = true
          transferResult.extensionList = await TransferExtensionModel.getByTransferId(id, isFulfilment)
        }
        if (transferResult.errorCode && transferResult.transferStateEnumeration === Enum.Transfers.TransferState.ABORTED) {
          if (!transferResult.extensionList) transferResult.extensionList = []
          transferResult.extensionList.push({
            key: 'cause',
            value: `${transferResult.errorCode}: ${transferResult.errorDescription}`.substr(0, 128),
            isError: true
          })
        }
        transferResult.isTransferReadModel = true
      }
      return transferResult
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getAll = async () => {
  try {
    return await Db.from('transfer').query(async (builder) => {
      const transferResultList = await builder
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
      for (const transferResult of transferResultList) {
        transferResult.extensionList = await TransferExtensionModel.getByTransferId(transferResult.transferId)
        transferResult.isTransferReadModel = true
      }
      return transferResultList
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getTransferInfoToChangePosition = async (id, transferParticipantRoleTypeId, ledgerEntryTypeId) => {
  try {
    /** @namespace Db.transferParticipant **/
    return await Db.from('transferParticipant').query(async builder => {
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
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const savePayeeTransferResponse = async (transferId, payload, action, fspiopError) => {
  const histTimerSavePayeeTranferResponsedEnd = Metrics.getHistogram(
    'model_transfer',
    'facade_savePayeeTransferResponse - Metrics for transfer model',
    ['success', 'queryName']
  ).startTimer()

  let state
  let isFulfilment = false
  let isError = false
  const errorCode = fspiopError && fspiopError.errorInformation && fspiopError.errorInformation.errorCode
  const errorDescription = fspiopError && fspiopError.errorInformation && fspiopError.errorInformation.errorDescription
  let extensionList
  switch (action) {
    case TransferEventAction.COMMIT:
    case TransferEventAction.BULK_COMMIT:
    case TransferEventAction.RESERVE:
      state = TransferInternalState.RECEIVED_FULFIL
      extensionList = payload && payload.extensionList
      isFulfilment = true
      break
    case TransferEventAction.REJECT:
      state = TransferInternalState.RECEIVED_REJECT
      extensionList = payload && payload.extensionList
      extensionList = payload.extensionList
      isFulfilment = true
      break
    case TransferEventAction.BULK_ABORT:
    case TransferEventAction.ABORT_VALIDATION:
    case TransferEventAction.ABORT:
      state = TransferInternalState.RECEIVED_ERROR
      extensionList = payload && payload.errorInformation && payload.errorInformation.extensionList
      isError = true
      break
    default:
      throw ErrorHandler.Factory.createInternalServerFSPIOPError(UnsupportedActionText)
  }
  const completedTimestamp = Time.getUTCString((payload.completedTimestamp && new Date(payload.completedTimestamp)) || new Date())
  const transactionTimestamp = Time.getUTCString(new Date())
  const result = {
    savePayeeTransferResponseExecuted: false
  }

  const transferFulfilmentRecord = {
    transferId,
    ilpFulfilment: payload.fulfilment || null,
    completedDate: completedTimestamp,
    isValid: !fspiopError,
    settlementWindowId: null,
    createdDate: transactionTimestamp
  }
  let transferExtensionRecordsList = []
  if (extensionList && extensionList.extension) {
    transferExtensionRecordsList = extensionList.extension.map(ext => {
      return {
        transferId,
        key: ext.key,
        value: ext.value,
        isFulfilment,
        isError
      }
    })
  }
  const transferStateChangeRecord = {
    transferId,
    transferStateId: state,
    reason: errorDescription,
    createdDate: transactionTimestamp
  }
  const transferErrorRecord = {
    transferId,
    transferStateChangeId: null,
    errorCode,
    errorDescription,
    createdDate: transactionTimestamp
  }

  try {
    /** @namespace Db.getKnex **/
    const knex = await Db.getKnex()
    const histTPayeeResponseValidationPassedEnd = Metrics.getHistogram(
      'model_transfer',
      'facade_saveTransferPrepared_transaction - Metrics for transfer model',
      ['success', 'queryName']
    ).startTimer()

    await knex.transaction(async (trx) => {
      try {
        if (!fspiopError && [TransferEventAction.COMMIT, TransferEventAction.BULK_COMMIT, TransferEventAction.RESERVE].includes(action)) {
          const res = await Db.from('settlementWindow').query(builder => {
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
          transferFulfilmentRecord.settlementWindowId = res[0].settlementWindowId
          Logger.isDebugEnabled && Logger.debug('savePayeeTransferResponse::settlementWindowId')
        }
        if (isFulfilment) {
          await knex('transferFulfilment').transacting(trx).insert(transferFulfilmentRecord)
          result.transferFulfilmentRecord = transferFulfilmentRecord
          Logger.isDebugEnabled && Logger.debug('savePayeeTransferResponse::transferFulfilment')
        }
        if (transferExtensionRecordsList.length > 0) {
          // ###! CAN BE DONE THROUGH A BATCH
          for (const transferExtension of transferExtensionRecordsList) {
            await knex('transferExtension').transacting(trx).insert(transferExtension)
          }
          // ###!
          result.transferExtensionRecordsList = transferExtensionRecordsList
          Logger.isDebugEnabled && Logger.debug('savePayeeTransferResponse::transferExtensionRecordsList')
        }
        await knex('transferStateChange').transacting(trx).insert(transferStateChangeRecord)
        result.transferStateChangeRecord = transferStateChangeRecord
        Logger.isDebugEnabled && Logger.debug('savePayeeTransferResponse::transferStateChange')
        if (fspiopError) {
          const insertedTransferStateChange = await knex('transferStateChange').transacting(trx)
            .where({ transferId })
            .forUpdate().first().orderBy('transferStateChangeId', 'desc')
          transferStateChangeRecord.transferStateChangeId = insertedTransferStateChange.transferStateChangeId
          transferErrorRecord.transferStateChangeId = insertedTransferStateChange.transferStateChangeId
          await knex('transferError').transacting(trx).insert(transferErrorRecord)
          result.transferErrorRecord = transferErrorRecord
          Logger.isDebugEnabled && Logger.debug('savePayeeTransferResponse::transferError')
        }
        histTPayeeResponseValidationPassedEnd({ success: true, queryName: 'facade_saveTransferPrepared_transaction' })
        result.savePayeeTransferResponseExecuted = true
        Logger.isDebugEnabled && Logger.debug('savePayeeTransferResponse::success')
      } catch (err) {
        await trx.rollback()
        histTPayeeResponseValidationPassedEnd({ success: false, queryName: 'facade_saveTransferPrepared_transaction' })
        Logger.isErrorEnabled && Logger.error('savePayeeTransferResponse::failure')
        throw err
      }
    })
    histTimerSavePayeeTranferResponsedEnd({ success: true, queryName: 'facade_savePayeeTransferResponse' })
    return result
  } catch (err) {
    histTimerSavePayeeTranferResponsedEnd({ success: false, queryName: 'facade_savePayeeTransferResponse' })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const saveTransferPrepared = async (payload, stateReason = null, hasPassedValidation = true) => {
  const histTimerSaveTransferPreparedEnd = Metrics.getHistogram(
    'model_transfer',
    'facade_saveTransferPrepared - Metrics for transfer model',
    ['success', 'queryName']
  ).startTimer()
  try {
    const participants = []
    const names = [payload.payeeFsp, payload.payerFsp]

    for (const name of names) {
      const participant = await ParticipantFacade.getByNameAndCurrency(name, payload.amount.currency, Enum.Accounts.LedgerAccountType.POSITION)
      if (participant) {
        participants.push(participant)
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

    const state = ((hasPassedValidation) ? Enum.Transfers.TransferInternalState.RECEIVED_PREPARE : Enum.Transfers.TransferInternalState.INVALID)

    const transferStateChangeRecord = {
      transferId: payload.transferId,
      transferStateId: state,
      reason: stateReason,
      createdDate: Time.getUTCString(new Date())
    }

    const payerTransferParticipantRecord = {
      transferId: payload.transferId,
      participantCurrencyId: participantCurrencyIds[payload.payerFsp],
      transferParticipantRoleTypeId: Enum.Accounts.TransferParticipantRoleType.PAYER_DFSP,
      ledgerEntryTypeId: Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE,
      amount: payload.amount.amount
    }

    const payeeTransferParticipantRecord = {
      transferId: payload.transferId,
      participantCurrencyId: participantCurrencyIds[payload.payeeFsp],
      transferParticipantRoleTypeId: Enum.Accounts.TransferParticipantRoleType.PAYEE_DFSP,
      ledgerEntryTypeId: Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE,
      amount: -payload.amount.amount
    }

    const knex = await Db.getKnex()
    if (hasPassedValidation) {
      const histTimerSaveTranferTransactionValidationPassedEnd = Metrics.getHistogram(
        'model_transfer',
        'facade_saveTransferPrepared_transaction - Metrics for transfer model',
        ['success', 'queryName']
      ).startTimer()
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
          await trx.commit()
          histTimerSaveTranferTransactionValidationPassedEnd({ success: true, queryName: 'facade_saveTransferPrepared_transaction' })
        } catch (err) {
          await trx.rollback()
          histTimerSaveTranferTransactionValidationPassedEnd({ success: false, queryName: 'facade_saveTransferPrepared_transaction' })
          throw err
        }
      })
    } else {
      const histTimerSaveTranferNoValidationEnd = Metrics.getHistogram(
        'model_transfer',
        'facade_saveTransferPrepared_no_validation - Metrics for transfer model',
        ['success', 'queryName']
      ).startTimer()
      await knex('transfer').insert(transferRecord)
      try {
        await knex('transferParticipant').insert(payerTransferParticipantRecord)
      } catch (err) {
        Logger.isWarnEnabled && Logger.warn(`Payer transferParticipant insert error: ${err.message}`)
        histTimerSaveTranferNoValidationEnd({ success: false, queryName: 'facade_saveTransferPrepared_no_validation' })
      }
      try {
        await knex('transferParticipant').insert(payeeTransferParticipantRecord)
      } catch (err) {
        histTimerSaveTranferNoValidationEnd({ success: false, queryName: 'facade_saveTransferPrepared_no_validation' })
        Logger.isWarnEnabled && Logger.warn(`Payee transferParticipant insert error: ${err.message}`)
      }
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
        try {
          await knex.batchInsert('transferExtension', transferExtensionsRecordList)
        } catch (err) {
          Logger.isWarnEnabled && Logger.warn(`batchInsert transferExtension error: ${err.message}`)
          histTimerSaveTranferNoValidationEnd({ success: false, queryName: 'facade_saveTransferPrepared_no_validation' })
        }
      }
      try {
        await knex('ilpPacket').insert(ilpPacketRecord)
      } catch (err) {
        Logger.isWarnEnabled && Logger.warn(`ilpPacket insert error: ${err.message}`)
        histTimerSaveTranferNoValidationEnd({ success: false, queryName: 'facade_saveTransferPrepared_no_validation' })
      }
      try {
        await knex('transferStateChange').insert(transferStateChangeRecord)
        histTimerSaveTranferNoValidationEnd({ success: true, queryName: 'facade_saveTransferPrepared_no_validation' })
      } catch (err) {
        Logger.isWarnEnabled && Logger.warn(`transferStateChange insert error: ${err.message}`)
        histTimerSaveTranferNoValidationEnd({ success: false, queryName: 'facade_saveTransferPrepared_no_validation' })
      }
    }
    histTimerSaveTransferPreparedEnd({ success: true, queryName: 'transfer_model_facade_saveTransferPrepared' })
  } catch (err) {
    histTimerSaveTransferPreparedEnd({ success: false, queryName: 'transfer_model_facade_saveTransferPrepared' })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
    return await Db.from('transferStateChange').query(async (builder) => {
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
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const timeoutExpireReserved = async (segmentId, intervalMin, intervalMax) => {
  try {
    const transactionTimestamp = Time.getUTCString(new Date())
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
              .whereIn('tsc.transferStateId', [`${Enum.Transfers.TransferInternalState.RECEIVED_PREPARE}`, `${Enum.Transfers.TransferState.RESERVED}`])
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
              .andWhere('tsc.transferStateId', `${Enum.Transfers.TransferInternalState.RECEIVED_PREPARE}`)
              .select('tt.transferId', knex.raw('?', Enum.Transfers.TransferInternalState.EXPIRED_PREPARED), knex.raw('?', 'Aborted by Timeout Handler'))
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
              .andWhere('tsc.transferStateId', `${Enum.Transfers.TransferState.RESERVED}`)
              .select('tt.transferId', knex.raw('?', Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT), knex.raw('?', 'Marked for expiration by Timeout Handler'))
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
        throw ErrorHandler.Factory.reformatFSPIOPError(err)
      }
    }).catch((err) => {
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
          .andOn('tp1.transferParticipantRoleTypeId', Enum.Accounts.TransferParticipantRoleType.PAYER_DFSP)
          .andOn('tp1.ledgerEntryTypeId', Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
      })
      .innerJoin('transferParticipant AS tp2', function () {
        this.on('tp2.transferId', 'tt.transferId')
          .andOn('tp2.transferParticipantRoleTypeId', Enum.Accounts.TransferParticipantRoleType.PAYEE_DFSP)
          .andOn('tp2.ledgerEntryTypeId', Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
      })
      .innerJoin('participantCurrency AS pc1', 'pc1.participantCurrencyId', 'tp1.participantCurrencyId')
      .innerJoin('participant AS p1', 'p1.participantId', 'pc1.participantId')

      .innerJoin('participantCurrency AS pc2', 'pc2.participantCurrencyId', 'tp2.participantCurrencyId')
      .innerJoin('participant AS p2', 'p2.participantId', 'pc2.participantId')

      .leftJoin('bulkTransferAssociation AS bta', 'bta.transferId', 'tt.transferId')

      .where('tt.expirationDate', '<', transactionTimestamp)
      .select('tt.*', 'tsc.transferStateId', 'tp1.participantCurrencyId AS payerParticipantId',
        'p1.name AS payerFsp', 'p2.name AS payeeFsp', 'tp2.participantCurrencyId AS payeeParticipantId',
        'bta.bulkTransferId')
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const transferStateAndPositionUpdate = async function (param1, enums, trx = null) {
  try {
    const knex = await Db.getKnex()

    const trxFunction = async (trx, doCommit = true) => {
      const transactionTimestamp = Time.getUTCString(new Date())
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
            .update({
              value: new MLNumber(info.drPositionValue).add(info.drAmount).toFixed(Config.AMOUNT.SCALE),
              changedDate: transactionTimestamp
            })
            .where('participantPositionId', info.drPositionId)
            .transacting(trx)

          await knex('participantPositionChange')
            .insert({
              participantPositionId: info.drPositionId,
              transferStateChangeId,
              value: new MLNumber(info.drPositionValue).add(info.drAmount).toFixed(Config.AMOUNT.SCALE),
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
            .update({
              value: new MLNumber(info.crPositionValue).add(info.crAmount).toFixed(Config.AMOUNT.SCALE),
              changedDate: transactionTimestamp
            })
            .where('participantPositionId', info.crPositionId)
            .transacting(trx)

          await knex('participantPositionChange')
            .insert({
              participantPositionId: info.crPositionId,
              transferStateChangeId,
              value: new MLNumber(info.crPositionValue).add(info.crAmount).toFixed(Config.AMOUNT.SCALE),
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
        drPositionValue: new MLNumber(info.drPositionValue).add(info.drAmount).toFixed(Config.AMOUNT.SCALE),
        crPositionValue: new MLNumber(info.crPositionValue).add(info.crAmount).toFixed(Config.AMOUNT.SCALE)
      }
    }

    if (trx) {
      return await trxFunction(trx, false)
    } else {
      return await knex.transaction(trxFunction)
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const reconciliationTransferPrepare = async function (payload, transactionTimestamp, enums, trx = null) {
  try {
    const knex = await Db.getKnex()

    const trxFunction = async (trx, doCommit = true) => {
      try {
        // transferDuplicateCheck check and insert is done prior to calling the prepare
        // see admin/handler.js :: transfer -> Comparators.duplicateCheckComparator

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
        const { reconciliationAccountId } = await knex('participantCurrency')
          .select('participantCurrencyId AS reconciliationAccountId')
          .where('participantId', Config.HUB_ID)
          .andWhere('currencyId', payload.amount.currency)
          .first()
          .transacting(trx)

        let ledgerEntryTypeId, amount
        if (payload.action === Enum.Transfers.AdminTransferAction.RECORD_FUNDS_IN) {
          ledgerEntryTypeId = enums.ledgerEntryType.RECORD_FUNDS_IN
          amount = payload.amount.amount
        } else if (payload.action === Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_PREPARE_RESERVE) {
          ledgerEntryTypeId = enums.ledgerEntryType.RECORD_FUNDS_OUT
          amount = -payload.amount.amount
        } else {
          throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, 'Action not allowed for reconciliationTransferPrepare')
        }

        // Insert transferParticipant records
        await knex('transferParticipant')
          .insert({
            transferId: payload.transferId,
            participantCurrencyId: reconciliationAccountId,
            transferParticipantRoleTypeId: enums.transferParticipantRoleType.HUB,
            ledgerEntryTypeId,
            amount,
            createdDate: transactionTimestamp
          })
          .transacting(trx)
        await knex('transferParticipant')
          .insert({
            transferId: payload.transferId,
            participantCurrencyId: payload.participantCurrencyId,
            transferParticipantRoleTypeId: enums.transferParticipantRoleType.DFSP_SETTLEMENT,
            ledgerEntryTypeId,
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
        for (const transferExtension of transferExtensions) {
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
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const reconciliationTransferReserve = async function (payload, transactionTimestamp, enums, trx = null) {
  try {
    const knex = await Db.getKnex()

    const trxFunction = async (trx, doCommit = true) => {
      try {
        const param1 = {
          transferId: payload.transferId,
          transferStateId: enums.transferState.RESERVED,
          reason: payload.reason,
          createdDate: transactionTimestamp,
          drUpdated: true,
          crUpdated: false
        }
        const positionResult = await TransferFacade.transferStateAndPositionUpdate(param1, enums, trx)

        if (payload.action === Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_PREPARE_RESERVE &&
          positionResult.drPositionValue > 0) {
          payload.reason = 'Aborted due to insufficient funds'
          payload.action = Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_ABORT
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
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const reconciliationTransferCommit = async function (payload, transactionTimestamp, enums, trx = null) {
  try {
    const knex = await Db.getKnex()

    const trxFunction = async (trx, doCommit = true) => {
      try {
        // Persist transfer state and participant position change
        const transferId = payload.transferId
        await knex('transferFulfilmentDuplicateCheck')
          .insert({
            transferId
          })
          .transacting(trx)

        await knex('transferFulfilment')
          .insert({
            transferId,
            ilpFulfilment: 0,
            completedDate: transactionTimestamp,
            isValid: 1,
            settlementWindowId: null,
            createdDate: transactionTimestamp
          })
          .transacting(trx)

        if (payload.action === Enum.Transfers.AdminTransferAction.RECORD_FUNDS_IN ||
          payload.action === Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_COMMIT) {
          const param1 = {
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
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const reconciliationTransferAbort = async function (payload, transactionTimestamp, enums, trx = null) {
  try {
    const knex = await Db.getKnex()

    const trxFunction = async (trx, doCommit = true) => {
      try {
        // Persist transfer state and participant position change
        const transferId = payload.transferId
        await knex('transferFulfilmentDuplicateCheck')
          .insert({
            transferId
          })
          .transacting(trx)

        await knex('transferFulfilment')
          .insert({
            transferId,
            ilpFulfilment: 0,
            completedDate: transactionTimestamp,
            isValid: 1,
            settlementWindowId: null,
            createdDate: transactionTimestamp
          })
          .transacting(trx)

        if (payload.action === Enum.Transfers.AdminTransferAction.RECORD_FUNDS_OUT_ABORT) {
          const param1 = {
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
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getTransferParticipant = async (participantName, transferId) => {
  try {
    return Db.from('participant').query(async (builder) => {
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
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const recordFundsIn = async (payload, transactionTimestamp, enums) => {
  const knex = Db.getKnex()
  // Save the valid transfer into the database
  return knex.transaction(async trx => {
    try {
      await TransferFacade.reconciliationTransferPrepare(payload, transactionTimestamp, enums, trx)
      await TransferFacade.reconciliationTransferReserve(payload, transactionTimestamp, enums, trx)
      await TransferFacade.reconciliationTransferCommit(payload, transactionTimestamp, enums, trx)
      await trx.commit
    } catch (err) {
      Logger.isErrorEnabled && Logger.error(err)
      await trx.rollback
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  })
}

const TransferFacade = {
  getById,
  getByIdLight,
  getAll,
  getTransferInfoToChangePosition,
  savePayeeTransferResponse,
  saveTransferPrepared,
  getTransferStateByTransferId,
  timeoutExpireReserved,
  transferStateAndPositionUpdate,
  reconciliationTransferPrepare,
  reconciliationTransferReserve,
  reconciliationTransferCommit,
  reconciliationTransferAbort,
  getTransferParticipant,
  recordFundsIn
}

module.exports = TransferFacade
