/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 * Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 ******/

'use strict'

/**
 * @module src/models/transfer/facade/
 */

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Metrics = require('@mojaloop/central-services-metrics')
const MLNumber = require('@mojaloop/ml-number')
const Enum = require('@mojaloop/central-services-shared').Enum
const Time = require('@mojaloop/central-services-shared').Util.Time

const { logger } = require('../../shared/logger')
const Db = require('../../lib/db')
const Config = require('../../lib/config')
const ParticipantFacade = require('../participant/facade')
const ParticipantCachedModel = require('../participant/participantCached')
const TransferExtensionModel = require('./transferExtension')
const rethrow = require('../../shared/rethrow')

const TransferEventAction = Enum.Events.Event.Action
const TransferInternalState = Enum.Transfers.TransferInternalState

// Alphabetically ordered list of error texts used below
const UnsupportedActionText = 'Unsupported action'

const getById = async (id) => {
  try {
    /** @namespace Db.transfer **/
    return await Db.from('transfer').query(async (builder) => {
      /* istanbul ignore next */
      const transferResult = await builder
        .where({
          'transfer.transferId': id,
          'tprt1.name': 'PAYER_DFSP', // TODO: refactor to use transferParticipantRoleTypeId
          'tprt2.name': 'PAYEE_DFSP'
        })
        // PAYER
        .innerJoin('transferParticipant AS tp1', 'tp1.transferId', 'transfer.transferId')
        .leftJoin('externalParticipant AS ep1', 'ep1.externalParticipantId', 'tp1.externalParticipantId')
        .innerJoin('transferParticipantRoleType AS tprt1', 'tprt1.transferParticipantRoleTypeId', 'tp1.transferParticipantRoleTypeId')
        .innerJoin('participant AS da', 'da.participantId', 'tp1.participantId')
        .leftJoin('participantCurrency AS pc1', 'pc1.participantCurrencyId', 'tp1.participantCurrencyId')
        // PAYEE
        .innerJoin('transferParticipant AS tp2', 'tp2.transferId', 'transfer.transferId')
        .leftJoin('externalParticipant AS ep2', 'ep2.externalParticipantId', 'tp2.externalParticipantId')
        .innerJoin('transferParticipantRoleType AS tprt2', 'tprt2.transferParticipantRoleTypeId', 'tp2.transferParticipantRoleTypeId')
        .innerJoin('participant AS ca', 'ca.participantId', 'tp2.participantId')
        .leftJoin('participantCurrency AS pc2', 'pc2.participantCurrencyId', 'tp2.participantCurrencyId')
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
          'da.isProxy AS payerIsProxy',
          'pc2.participantCurrencyId AS payeeParticipantCurrencyId',
          'tp2.amount AS payeeAmount',
          'ca.participantId AS payeeParticipantId',
          'ca.name AS payeeFsp',
          'ca.isProxy AS payeeIsProxy',
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
          'te.errorDescription',
          'ep1.name AS externalPayerName',
          'ep2.name AS externalPayeeName'
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
    logger.warn('error in transfer.getById', err)
    rethrow.rethrowDatabaseError(err)
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
    logger.warn('error in transfer.getByIdLight', err)
    rethrow.rethrowDatabaseError(err)
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
    logger.warn('error in transfer.getAll', err)
    rethrow.rethrowDatabaseError(err)
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
        .innerJoin('transfer AS t', 't.transferId', 'transferParticipant.transferId')
        .select(
          'transferParticipant.*',
          't.currencyId',
          'tsc.transferStateId',
          'tsc.reason'
        )
        .orderBy('tsc.transferStateChangeId', 'desc')
        .first()
    })
  } catch (err) {
    logger.warn('error in getTransferInfoToChangePosition', err)
    rethrow.rethrowDatabaseError(err)
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
    const knex = Db.getKnex()
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
          logger.debug('savePayeeTransferResponse::settlementWindowId')
        }
        if (isFulfilment) {
          await knex('transferFulfilment').transacting(trx).insert(transferFulfilmentRecord)
          result.transferFulfilmentRecord = transferFulfilmentRecord
          logger.debug('savePayeeTransferResponse::transferFulfilment')
        }
        if (transferExtensionRecordsList.length > 0) {
          // ###! CAN BE DONE THROUGH A BATCH
          for (const transferExtension of transferExtensionRecordsList) {
            await knex('transferExtension').transacting(trx).insert(transferExtension)
          }
          // ###!
          result.transferExtensionRecordsList = transferExtensionRecordsList
          logger.debug('savePayeeTransferResponse::transferExtensionRecordsList')
        }
        await knex('transferStateChange').transacting(trx).insert(transferStateChangeRecord)
        result.transferStateChangeRecord = transferStateChangeRecord
        logger.debug('savePayeeTransferResponse::transferStateChange')
        if (fspiopError) {
          const insertedTransferStateChange = await knex('transferStateChange').transacting(trx)
            .where({ transferId })
            .forUpdate().first().orderBy('transferStateChangeId', 'desc')
          transferStateChangeRecord.transferStateChangeId = insertedTransferStateChange.transferStateChangeId
          transferErrorRecord.transferStateChangeId = insertedTransferStateChange.transferStateChangeId
          await knex('transferError').transacting(trx).insert(transferErrorRecord)
          result.transferErrorRecord = transferErrorRecord
          logger.debug('savePayeeTransferResponse::transferError')
        }
        histTPayeeResponseValidationPassedEnd({ success: true, queryName: 'facade_saveTransferPrepared_transaction' })
        result.savePayeeTransferResponseExecuted = true
        logger.debug('savePayeeTransferResponse::success')
      } catch (err) {
        logger.error('savePayeeTransferResponse::failure', err)
        histTPayeeResponseValidationPassedEnd({ success: false, queryName: 'facade_saveTransferPrepared_transaction' })
        rethrow.rethrowDatabaseError(err)
      }
    })
    histTimerSavePayeeTranferResponsedEnd({ success: true, queryName: 'facade_savePayeeTransferResponse' })
    return result
  } catch (err) {
    logger.warn('error in savePayeeTransferResponse', err)
    histTimerSavePayeeTranferResponsedEnd({ success: false, queryName: 'facade_savePayeeTransferResponse' })
    rethrow.rethrowDatabaseError(err)
  }
}

/**
 * Saves prepare transfer details to DB.
 *
 * @param {Object} payload - Message payload.
 * @param {string | null} stateReason - Validation failure reasons.
 * @param {Boolean} hasPassedValidation - Is transfer prepare validation passed.
 * @param {DeterminingTransferCheckResult} determiningTransferCheckResult - Determining transfer check result.
 * @param {ProxyObligation} proxyObligation - The proxy obligation
 * @returns {Promise<void>}
 */
const saveTransferPrepared = async (payload, stateReason = null, hasPassedValidation = true, determiningTransferCheckResult, proxyObligation) => {
  const histTimerSaveTransferPreparedEnd = Metrics.getHistogram(
    'model_transfer',
    'facade_saveTransferPrepared - Metrics for transfer model',
    ['success', 'queryName']
  ).startTimer()
  try {
    const participants = {
      [payload.payeeFsp]: {},
      [payload.payerFsp]: {}
    }

    // Iterate over the participants and get the details
    for (const name of Object.keys(participants)) {
      const participant = await ParticipantCachedModel.getByName(name)
      if (participant) {
        participants[name].id = participant.participantId
      }
      // If determiningTransferCheckResult.participantCurrencyValidationList contains the participant name, then get the participantCurrencyId
      const participantCurrency = determiningTransferCheckResult && determiningTransferCheckResult.participantCurrencyValidationList.find(participantCurrencyItem => participantCurrencyItem.participantName === name)
      if (participantCurrency) {
        const participantCurrencyRecord = await ParticipantFacade.getByNameAndCurrency(participantCurrency.participantName, participantCurrency.currencyId, Enum.Accounts.LedgerAccountType.POSITION)
        participants[name].participantCurrencyId = participantCurrencyRecord?.participantCurrencyId
      }
    }

    if (proxyObligation?.isInitiatingFspProxy) {
      const proxyId = proxyObligation.initiatingFspProxyOrParticipantId.proxyId
      const proxyParticipant = await ParticipantCachedModel.getByName(proxyId)
      participants[proxyId] = {}
      participants[proxyId].id = proxyParticipant.participantId
      const participantCurrencyRecord = await ParticipantFacade.getByNameAndCurrency(
        proxyId, payload.amount.currency, Enum.Accounts.LedgerAccountType.POSITION
      )
      // In a regional scheme, the stand-in initiating FSP proxy may not have a participantCurrencyId
      // of the target currency of the transfer, so set to null if not found
      participants[proxyId].participantCurrencyId = participantCurrencyRecord?.participantCurrencyId
    }

    if (proxyObligation?.isCounterPartyFspProxy) {
      const proxyId = proxyObligation.counterPartyFspProxyOrParticipantId.proxyId
      const proxyParticipant = await ParticipantCachedModel.getByName(proxyId)
      participants[proxyId] = {}
      participants[proxyId].id = proxyParticipant.participantId
    }

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

    const transferStateChangeRecord = {
      transferId: payload.transferId,
      transferStateId: hasPassedValidation ? TransferInternalState.RECEIVED_PREPARE : TransferInternalState.INVALID,
      reason: stateReason,
      createdDate: Time.getUTCString(new Date())
    }

    let payerTransferParticipantRecord
    if (proxyObligation?.isInitiatingFspProxy) {
      const externalParticipantId = await ParticipantFacade.getExternalParticipantIdByNameOrCreate(proxyObligation.initiatingFspProxyOrParticipantId)
      payerTransferParticipantRecord = {
        transferId: payload.transferId,
        participantId: participants[proxyObligation.initiatingFspProxyOrParticipantId.proxyId].id,
        participantCurrencyId: participants[proxyObligation.initiatingFspProxyOrParticipantId.proxyId].participantCurrencyId,
        transferParticipantRoleTypeId: Enum.Accounts.TransferParticipantRoleType.PAYER_DFSP,
        ledgerEntryTypeId: Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE,
        amount: payload.amount.amount,
        externalParticipantId
      }
    } else {
      payerTransferParticipantRecord = {
        transferId: payload.transferId,
        participantId: participants[payload.payerFsp].id,
        participantCurrencyId: participants[payload.payerFsp].participantCurrencyId,
        transferParticipantRoleTypeId: Enum.Accounts.TransferParticipantRoleType.PAYER_DFSP,
        ledgerEntryTypeId: Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE,
        amount: payload.amount.amount
      }
    }

    logger.debug('saveTransferPrepared participants:', { participants })
    let payeeTransferParticipantRecord
    if (proxyObligation?.isCounterPartyFspProxy) {
      const externalParticipantId = await ParticipantFacade.getExternalParticipantIdByNameOrCreate(proxyObligation.counterPartyFspProxyOrParticipantId)
      payeeTransferParticipantRecord = {
        transferId: payload.transferId,
        participantId: participants[proxyObligation.counterPartyFspProxyOrParticipantId.proxyId].id,
        participantCurrencyId: null,
        transferParticipantRoleTypeId: Enum.Accounts.TransferParticipantRoleType.PAYEE_DFSP,
        ledgerEntryTypeId: Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE,
        amount: -payload.amount.amount,
        externalParticipantId
      }
    } else {
      payeeTransferParticipantRecord = {
        transferId: payload.transferId,
        participantId: participants[payload.payeeFsp].id,
        participantCurrencyId: participants[payload.payeeFsp].participantCurrencyId,
        transferParticipantRoleTypeId: Enum.Accounts.TransferParticipantRoleType.PAYEE_DFSP,
        ledgerEntryTypeId: Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE,
        amount: -payload.amount.amount
      }
    }

    const knex = Db.getKnex()
    if (hasPassedValidation) {
      const histTimerSaveTransferTransactionValidationPassedEnd = Metrics.getHistogram(
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
          histTimerSaveTransferTransactionValidationPassedEnd({ success: true, queryName: 'facade_saveTransferPrepared_transaction' })
        } catch (err) {
          histTimerSaveTransferTransactionValidationPassedEnd({ success: false, queryName: 'facade_saveTransferPrepared_transaction' })
          rethrow.rethrowDatabaseError(err)
        }
      })
    } else {
      const histTimerSaveTransferNoValidationEnd = Metrics.getHistogram(
        'model_transfer',
        'facade_saveTransferPrepared_no_validation - Metrics for transfer model',
        ['success', 'queryName']
      ).startTimer()
      await knex('transfer').insert(transferRecord)
      try {
        await knex('transferParticipant').insert(payerTransferParticipantRecord)
      } catch (err) {
        logger.warn('Payer transferParticipant insert error', err)
        histTimerSaveTransferNoValidationEnd({ success: false, queryName: 'facade_saveTransferPrepared_no_validation' })
      }
      try {
        await knex('transferParticipant').insert(payeeTransferParticipantRecord)
      } catch (err) {
        logger.warn('Payee transferParticipant insert error:', err)
        histTimerSaveTransferNoValidationEnd({ success: false, queryName: 'facade_saveTransferPrepared_no_validation' })
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
          logger.warn('batchInsert transferExtension error:', err)
          histTimerSaveTransferNoValidationEnd({ success: false, queryName: 'facade_saveTransferPrepared_no_validation' })
        }
      }
      try {
        await knex('ilpPacket').insert(ilpPacketRecord)
      } catch (err) {
        logger.warn('ilpPacket insert error:', err)
        histTimerSaveTransferNoValidationEnd({ success: false, queryName: 'facade_saveTransferPrepared_no_validation' })
      }
      try {
        await knex('transferStateChange').insert(transferStateChangeRecord)
        histTimerSaveTransferNoValidationEnd({ success: true, queryName: 'facade_saveTransferPrepared_no_validation' })
      } catch (err) {
        logger.warn('transferStateChange insert error:', err)
        histTimerSaveTransferNoValidationEnd({ success: false, queryName: 'facade_saveTransferPrepared_no_validation' })
      }
    }
    histTimerSaveTransferPreparedEnd({ success: true, queryName: 'transfer_model_facade_saveTransferPrepared' })
  } catch (err) {
    logger.warn('error in saveTransferPrepared', err)
    histTimerSaveTransferPreparedEnd({ success: false, queryName: 'transfer_model_facade_saveTransferPrepared' })
    rethrow.rethrowDatabaseError(err)
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
    rethrow.rethrowDatabaseError(err)
  }
}

const _processTimeoutEntries = async (knex, trx, transactionTimestamp) => {
  // Insert `transferStateChange` records for RECEIVED_PREPARE
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
    })

  // Insert `transferStateChange` records for RESERVED
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
    })
}

const _insertTransferErrorEntries = async (knex, trx, transactionTimestamp) => {
  // Insert `transferError` records
  await knex.from(knex.raw('transferError (transferId, transferStateChangeId, errorCode, errorDescription)')).transacting(trx)
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
        .andWhere('tsc.transferStateId', `${Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT}`)
        .select('tt.transferId', 'tsc.transferStateChangeId', knex.raw('?', ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.code), knex.raw('?', ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.message))
    })
}

const _processFxTimeoutEntries = async (knex, trx, transactionTimestamp) => {
  // Insert `fxTransferStateChange` records for RECEIVED_PREPARE
  /* istanbul ignore next */
  await knex.from(knex.raw('fxTransferStateChange (commitRequestId, transferStateId, reason)')).transacting(trx)
    .insert(function () {
      this.from('fxTransferTimeout AS ftt')
        .innerJoin(knex('fxTransferStateChange AS ftsc1')
          .select('ftsc1.commitRequestId')
          .max('ftsc1.fxTransferStateChangeId AS maxFxTransferStateChangeId')
          .innerJoin('fxTransferTimeout AS ftt1', 'ftt1.commitRequestId', 'ftsc1.commitRequestId')
          .groupBy('ftsc1.commitRequestId').as('fts'), 'fts.commitRequestId', 'ftt.commitRequestId'
        )
        .innerJoin('fxTransferStateChange AS ftsc', 'ftsc.fxTransferStateChangeId', 'fts.maxFxTransferStateChangeId')
        .where('ftt.expirationDate', '<', transactionTimestamp)
        .andWhere('ftsc.transferStateId', `${Enum.Transfers.TransferInternalState.RECEIVED_PREPARE}`)
        .select('ftt.commitRequestId', knex.raw('?', Enum.Transfers.TransferInternalState.EXPIRED_PREPARED), knex.raw('?', 'Aborted by Timeout Handler'))
    })

  // Insert `fxTransferStateChange` records for RESERVED
  await knex.from(knex.raw('fxTransferStateChange (commitRequestId, transferStateId, reason)')).transacting(trx)
    .insert(function () {
      this.from('fxTransferTimeout AS ftt')
        .innerJoin(knex('fxTransferStateChange AS ftsc1')
          .select('ftsc1.commitRequestId')
          .max('ftsc1.fxTransferStateChangeId AS maxFxTransferStateChangeId')
          .innerJoin('fxTransferTimeout AS ftt1', 'ftt1.commitRequestId', 'ftsc1.commitRequestId')
          .groupBy('ftsc1.commitRequestId').as('fts'), 'fts.commitRequestId', 'ftt.commitRequestId'
        )
        .innerJoin('fxTransferStateChange AS ftsc', 'ftsc.fxTransferStateChangeId', 'fts.maxFxTransferStateChangeId')
        .where('ftt.expirationDate', '<', transactionTimestamp)
        .andWhere('ftsc.transferStateId', `${Enum.Transfers.TransferState.RESERVED}`)
        .select('ftt.commitRequestId', knex.raw('?', Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT), knex.raw('?', 'Marked for expiration by Timeout Handler'))
    })

  // Insert `fxTransferStateChange` records for RECEIVED_FULFIL_DEPENDENT
  await knex.from(knex.raw('fxTransferStateChange (commitRequestId, transferStateId, reason)')).transacting(trx)
    .insert(function () {
      this.from('fxTransferTimeout AS ftt')
        .innerJoin(knex('fxTransferStateChange AS ftsc1')
          .select('ftsc1.commitRequestId')
          .max('ftsc1.fxTransferStateChangeId AS maxFxTransferStateChangeId')
          .innerJoin('fxTransferTimeout AS ftt1', 'ftt1.commitRequestId', 'ftsc1.commitRequestId')
          .groupBy('ftsc1.commitRequestId').as('fts'), 'fts.commitRequestId', 'ftt.commitRequestId'
        )
        .innerJoin('fxTransferStateChange AS ftsc', 'ftsc.fxTransferStateChangeId', 'fts.maxFxTransferStateChangeId')
        .where('ftt.expirationDate', '<', transactionTimestamp)
        .andWhere('ftsc.transferStateId', `${Enum.Transfers.TransferInternalState.RECEIVED_FULFIL_DEPENDENT}`)
        .select('ftt.commitRequestId', knex.raw('?', Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT), knex.raw('?', 'Marked for expiration by Timeout Handler'))
    })
}

const _insertFxTransferErrorEntries = async (knex, trx, transactionTimestamp) => {
  // Insert `fxTransferError` records
  await knex.from(knex.raw('fxTransferError (commitRequestId, fxTransferStateChangeId, errorCode, errorDescription)')).transacting(trx)
    .insert(function () {
      this.from('fxTransferTimeout AS ftt')
        .innerJoin(knex('fxTransferStateChange AS ftsc1')
          .select('ftsc1.commitRequestId')
          .max('ftsc1.fxTransferStateChangeId AS maxFxTransferStateChangeId')
          .innerJoin('fxTransferTimeout AS ftt1', 'ftt1.commitRequestId', 'ftsc1.commitRequestId')
          .groupBy('ftsc1.commitRequestId').as('fts'), 'fts.commitRequestId', 'ftt.commitRequestId'
        )
        .innerJoin('fxTransferStateChange AS ftsc', 'ftsc.fxTransferStateChangeId', 'fts.maxFxTransferStateChangeId')
        .where('ftt.expirationDate', '<', transactionTimestamp)
        .andWhere('ftsc.transferStateId', `${Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT}`)
        .select('ftt.commitRequestId', 'ftsc.fxTransferStateChangeId', knex.raw('?', ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.code), knex.raw('?', ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.message))
    })
}

const _getTransferList = async (knex, tableName = 'transferTimeout', transactionTimestamp, maxAttemptCount = null) => {
  /* istanbul ignore next */
  const query = knex(`${tableName} AS tt`)
    .innerJoin(knex('transferStateChange AS tsc1')
      .select('tsc1.transferId')
      .max('tsc1.transferStateChangeId AS maxTransferStateChangeId')
      .innerJoin(`${tableName} AS tt1`, 'tt1.transferId', 'tsc1.transferId')
      .groupBy('tsc1.transferId')
      .as('ts'), 'ts.transferId', 'tt.transferId'
    )
    .innerJoin('transferStateChange AS tsc', 'tsc.transferStateChangeId', 'ts.maxTransferStateChangeId')
    .innerJoin('transferParticipant AS tp1', function () {
      this.on('tp1.transferId', 'tt.transferId')
        .andOn('tp1.transferParticipantRoleTypeId', Enum.Accounts.TransferParticipantRoleType.PAYER_DFSP)
        .andOn('tp1.ledgerEntryTypeId', Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
    })
    .leftJoin('externalParticipant AS ep1', 'ep1.externalParticipantId', 'tp1.externalParticipantId')
    .innerJoin('transferParticipant AS tp2', function () {
      this.on('tp2.transferId', 'tt.transferId')
        .andOn('tp2.transferParticipantRoleTypeId', Enum.Accounts.TransferParticipantRoleType.PAYEE_DFSP)
        .andOn('tp2.ledgerEntryTypeId', Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
    })
    .leftJoin('externalParticipant AS ep2', 'ep2.externalParticipantId', 'tp2.externalParticipantId')
    .innerJoin('participant AS p1', 'p1.participantId', 'tp1.participantId')
    .innerJoin('participant AS p2', 'p2.participantId', 'tp2.participantId')
    .innerJoin(knex('transferStateChange AS tsc2')
      .select('tsc2.transferId', 'tsc2.transferStateChangeId', 'ppc1.participantCurrencyId')
      .innerJoin(`${tableName} AS tt2`, 'tt2.transferId', 'tsc2.transferId')
      .innerJoin('participantPositionChange AS ppc1', 'ppc1.transferStateChangeId', 'tsc2.transferStateChangeId')
      .as('tpc'), 'tpc.transferId', 'tt.transferId'
    )
    .leftJoin('bulkTransferAssociation AS bta', 'bta.transferId', 'tt.transferId')
    .where('tt.expirationDate', '<', transactionTimestamp)

  if (tableName === 'transferForwarded' && maxAttemptCount !== null) {
    query.andWhere('tt.attemptCount', '<', maxAttemptCount)
  }

  return query.select(
    'tt.*',
    'tsc.transferStateId',
    'tp1.participantCurrencyId AS payerParticipantCurrencyId',
    'p1.name AS payerFsp',
    'p2.name AS payeeFsp',
    'tp2.participantCurrencyId AS payeeParticipantCurrencyId',
    'bta.bulkTransferId',
    'tpc.participantCurrencyId AS effectedParticipantCurrencyId',
    'ep1.name AS externalPayerName',
    'ep2.name AS externalPayeeName'
  )
}

const _getFxTransferList = async (knex, tableName = 'fxTransferTimeout', transactionTimestamp, maxAttemptCount = null) => {
  /* istanbul ignore next */
  const query = knex(`${tableName} AS ftt`)
    .innerJoin(knex('fxTransferStateChange AS ftsc1')
      .select('ftsc1.commitRequestId')
      .max('ftsc1.fxTransferStateChangeId AS maxFxTransferStateChangeId')
      .innerJoin(`${tableName} AS ftt1`, 'ftt1.commitRequestId', 'ftsc1.commitRequestId')
      .groupBy('ftsc1.commitRequestId')
      .as('fts'), 'fts.commitRequestId', 'ftt.commitRequestId'
    )
    .innerJoin('fxTransferStateChange AS ftsc', 'ftsc.fxTransferStateChangeId', 'fts.maxFxTransferStateChangeId')
    .innerJoin('fxTransferParticipant AS ftp1', function () {
      this.on('ftp1.commitRequestId', 'ftt.commitRequestId')
        .andOn('ftp1.transferParticipantRoleTypeId', Enum.Accounts.TransferParticipantRoleType.INITIATING_FSP)
        .andOn('ftp1.ledgerEntryTypeId', Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
    })
    .leftJoin('externalParticipant AS ep1', 'ep1.externalParticipantId', 'ftp1.externalParticipantId')
    .innerJoin('fxTransferParticipant AS ftp2', function () {
      this.on('ftp2.commitRequestId', 'ftt.commitRequestId')
        .andOn('ftp2.transferParticipantRoleTypeId', Enum.Accounts.TransferParticipantRoleType.COUNTER_PARTY_FSP)
        .andOn('ftp2.fxParticipantCurrencyTypeId', Enum.Fx.FxParticipantCurrencyType.TARGET)
        .andOn('ftp2.ledgerEntryTypeId', Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE)
    })
    .leftJoin('externalParticipant AS ep2', 'ep2.externalParticipantId', 'ftp2.externalParticipantId')
    .innerJoin('participant AS p1', 'p1.participantId', 'ftp1.participantId')
    .innerJoin('participant AS p2', 'p2.participantId', 'ftp2.participantId')
    .innerJoin(knex('fxTransferStateChange AS ftsc2')
      .select('ftsc2.commitRequestId', 'ftsc2.fxTransferStateChangeId', 'ppc1.participantCurrencyId')
      .innerJoin(`${tableName} AS ftt2`, 'ftt2.commitRequestId', 'ftsc2.commitRequestId')
      .innerJoin('participantPositionChange AS ppc1', 'ppc1.fxTransferStateChangeId', 'ftsc2.fxTransferStateChangeId')
      .as('ftpc'), 'ftpc.commitRequestId', 'ftt.commitRequestId'
    )
    .where('ftt.expirationDate', '<', transactionTimestamp)

  if (tableName === 'fxTransferForwarded' && maxAttemptCount !== null) {
    query.andWhere('ftt.attemptCount', '<', maxAttemptCount)
  }

  return query.select(
    'ftt.*',
    'ftsc.transferStateId',
    'ftp1.participantCurrencyId AS initiatingParticipantCurrencyId',
    'p1.name AS initiatingFsp',
    'p2.name AS counterPartyFsp',
    'ftp2.participantCurrencyId AS counterPartyParticipantCurrencyId',
    'ftpc.participantCurrencyId AS effectedParticipantCurrencyId',
    'ep1.name AS externalInitiatingFspName',
    'ep2.name AS externalCounterPartyFspName'
  )
}

/**
 * @typedef {Object} TimedOutTransfer
 *
 * @property {Integer} transferTimeoutId
 * @property {String} transferId
 * @property {Date} expirationDate
 * @property {Date} createdDate
 * @property {String} transferStateId
 * @property {String} payerFsp
 * @property {String} payeeFsp
 * @property {Integer} payerParticipantCurrencyId
 * @property {Integer} payeeParticipantCurrencyId
 * @property {Integer} bulkTransferId
 * @property {Integer} effectedParticipantCurrencyId
 * @property {String} externalPayerName
 * @property {String} externalPayeeName
 */

/**
 * @typedef {Object} TimedOutFxTransfer
 *
 * @property {Integer} fxTransferTimeoutId
 * @property {String} commitRequestId
 * @property {Date} expirationDate
 * @property {Date} createdDate
 * @property {String} transferStateId
 * @property {String} initiatingFsp
 * @property {String} counterPartyFsp
 * @property {Integer} initiatingParticipantCurrencyId
 * @property {Integer} counterPartyParticipantCurrencyId
 * @property {Integer} effectedParticipantCurrencyId
 * @property {String} externalInitiatingFspName
 * @property {String} externalCounterPartyFspName
 */

/**
 *  Returns the list of transfers/fxTransfers that have timed out
 *
 * @returns {Promise<{
 *    transferTimeoutList: TimedOutTransfer,
 *    fxTransferTimeoutList: TimedOutFxTransfer
 * }>}
 */
const timeoutExpireReserved = async (segmentId, intervalMin, intervalMax, fxSegmentId, fxIntervalMin, fxIntervalMax) => {
  try {
    const transactionTimestamp = Time.getUTCString(new Date())
    const knex = Db.getKnex()
    await knex.transaction(async (trx) => {
      try {
        // Insert `transferTimeout` records for transfers found between the interval intervalMin <= intervalMax
        await knex.from(knex.raw('transferTimeout (transferId, expirationDate)')).transacting(trx)
          .insert(function () {
            this.from('transfer AS t')
              .innerJoin(knex('transferStateChange')
                .select('transferId')
                .max('transferStateChangeId AS maxTransferStateChangeId')
                .where('transferStateChangeId', '>', intervalMin)
                .andWhere('transferStateChangeId', '<=', intervalMax)
                .groupBy('transferId')
                .as('ts'), 'ts.transferId', 't.transferId'
              )
              .innerJoin('transferStateChange AS tsc', 'tsc.transferStateChangeId', 'ts.maxTransferStateChangeId')
              .leftJoin('transferTimeout AS tt', 'tt.transferId', 't.transferId')
              .whereNull('tt.transferId')
              .whereIn('tsc.transferStateId', [`${Enum.Transfers.TransferInternalState.RECEIVED_PREPARE}`, `${Enum.Transfers.TransferState.RESERVED}`])
              .select('t.transferId', 't.expirationDate')
          })

        // Insert `fxTransferTimeout` records for fxTransfers found between the interval intervalMin <= intervalMax and related fxTransfers
        await knex.from(knex.raw('fxTransferTimeout (commitRequestId, expirationDate)')).transacting(trx)
          .insert(function () {
            this.from('fxTransfer AS ft')
              .innerJoin(knex('fxTransferStateChange')
                .select('commitRequestId')
                .max('fxTransferStateChangeId AS maxFxTransferStateChangeId')
                .where('fxTransferStateChangeId', '>', fxIntervalMin)
                .andWhere('fxTransferStateChangeId', '<=', fxIntervalMax)
                .groupBy('commitRequestId').as('fts'), 'fts.commitRequestId', 'ft.commitRequestId'
              )
              .innerJoin('fxTransferStateChange AS ftsc', 'ftsc.fxTransferStateChangeId', 'fts.maxFxTransferStateChangeId')
              .leftJoin('fxTransferTimeout AS ftt', 'ftt.commitRequestId', 'ft.commitRequestId')
              .leftJoin('fxTransfer AS ft1', 'ft1.determiningTransferId', 'ft.determiningTransferId')
              .whereNull('ftt.commitRequestId')
              .whereIn('ftsc.transferStateId', [
                `${Enum.Transfers.TransferInternalState.RECEIVED_PREPARE}`,
                `${Enum.Transfers.TransferState.RESERVED}`
              ])
              .select('ft1.commitRequestId', 'ft.expirationDate') // Passing expiration date of the timed out fxTransfer for all related fxTransfers
          })

        await _processTimeoutEntries(knex, trx, transactionTimestamp)
        await _processFxTimeoutEntries(knex, trx, transactionTimestamp)

        // Insert `fxTransferTimeout` records for the related fxTransfers, or update if exists. The expiration date will be of the transfer and not from fxTransfer
        await knex.from(knex.raw('fxTransferTimeout (commitRequestId, expirationDate)')).transacting(trx)
          .insert(function () {
            this.from('fxTransfer AS ft')
              .innerJoin(
                knex('transferTimeout AS tt')
                  .select('tt.transferId', 'tt.expirationDate')
                  .innerJoin(
                    knex('transferStateChange as tsc1')
                      .select('tsc1.transferId')
                      .max('tsc1.transferStateChangeId AS maxTransferStateChangeId')
                      .innerJoin('transferTimeout AS tt1', 'tt1.transferId', 'tsc1.transferId')
                      .groupBy('tsc1.transferId')
                      .as('ts'),
                    'ts.transferId', 'tt.transferId'
                  )
                  .innerJoin('transferStateChange AS tsc', 'tsc.transferStateChangeId', 'ts.maxTransferStateChangeId')
                  .where('tt.expirationDate', '<', transactionTimestamp)
                  .whereIn('tsc.transferStateId', [
                  `${Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT}`,
                  `${Enum.Transfers.TransferInternalState.EXPIRED_PREPARED}`
                  ])
                  .as('tt1'),
                'ft.determiningTransferId', 'tt1.transferId'
              )
              .select('ft.commitRequestId', 'tt1.expirationDate')
          })
          .onConflict('commitRequestId')
          .merge({
            expirationDate: knex.raw('VALUES(expirationDate)')
          })

        // Insert `transferTimeout` records for the related transfers, or update if exists. The expiration date will be of the fxTransfer and not from transfer
        await knex.from(knex.raw('transferTimeout (transferId, expirationDate)')).transacting(trx)
          .insert(function () {
            this.from('fxTransfer AS ft')
              .innerJoin(
                knex('fxTransferTimeout AS ftt')
                  .select('ftt.commitRequestId', 'ftt.expirationDate')
                  .innerJoin(
                    knex('fxTransferStateChange AS ftsc1')
                      .select('ftsc1.commitRequestId')
                      .max('ftsc1.fxTransferStateChangeId AS maxFxTransferStateChangeId')
                      .innerJoin('fxTransferTimeout AS ftt1', 'ftt1.commitRequestId', 'ftsc1.commitRequestId')
                      .groupBy('ftsc1.commitRequestId')
                      .as('fts'),
                    'fts.commitRequestId', 'ftt.commitRequestId'
                  )
                  .innerJoin('fxTransferStateChange AS ftsc', 'ftsc.fxTransferStateChangeId', 'fts.maxFxTransferStateChangeId')
                  .where('ftt.expirationDate', '<', transactionTimestamp)
                  .whereIn('ftsc.transferStateId', [
                  `${Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT}`,
                  `${Enum.Transfers.TransferInternalState.EXPIRED_PREPARED}`
                  ])
                  .as('ftt1'),
                'ft.commitRequestId', 'ftt1.commitRequestId'
              )
              .innerJoin(
                knex('transferStateChange AS tsc')
                  .select('tsc.transferId')
                  .innerJoin(
                    knex('transferStateChange AS tsc1')
                      .select('tsc1.transferId')
                      .max('tsc1.transferStateChangeId AS maxTransferStateChangeId')
                      .groupBy('tsc1.transferId')
                      .as('ts'),
                    'ts.transferId', 'tsc.transferId'
                  )
                  .whereRaw('tsc.transferStateChangeId = ts.maxTransferStateChangeId')
                  .whereIn('tsc.transferStateId', [
                  `${Enum.Transfers.TransferInternalState.RECEIVED_PREPARE}`,
                  `${Enum.Transfers.TransferState.RESERVED}`
                  ])
                  .as('tt1'),
                'ft.determiningTransferId', 'tt1.transferId'
              )
              .select('tt1.transferId', 'ftt1.expirationDate')
          })
          .onConflict('transferId')
          .merge({
            expirationDate: knex.raw('VALUES(expirationDate)')
          })

        await _processTimeoutEntries(knex, trx, transactionTimestamp)
        await _processFxTimeoutEntries(knex, trx, transactionTimestamp)
        await _insertTransferErrorEntries(knex, trx, transactionTimestamp)
        await _insertFxTransferErrorEntries(knex, trx, transactionTimestamp)

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
        if (fxSegmentId === 0) {
          const fxSegment = {
            segmentType: 'timeout',
            enumeration: 0,
            tableName: 'fxTransferStateChange',
            value: fxIntervalMax
          }
          await knex('segment').transacting(trx).insert(fxSegment)
        } else {
          await knex('segment').transacting(trx).where({ segmentId: fxSegmentId }).update({ value: fxIntervalMax })
        }
      } catch (err) {
        rethrow.rethrowDatabaseError(err)
      }
    }).catch((err) => {
      rethrow.rethrowDatabaseError(err)
    })

    const transferTimeoutList = await _getTransferList(knex, 'transferTimeout', transactionTimestamp)
    const fxTransferTimeoutList = await _getFxTransferList(knex, 'fxTransferTimeout', transactionTimestamp)

    return {
      transferTimeoutList,
      fxTransferTimeoutList
    }
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

/**
 *  Returns the list of transfers/fxTransfers that are in RESERVED_FORWARDED state
 *
 * @returns {Promise<{
 *    transferTimeoutList: TimedOutTransfer,
 *    fxTransferTimeoutList: TimedOutFxTransfer
 * }>}
 */
const reservedForwardedTransfers = async (intervalMin, intervalMax, fxIntervalMin, fxIntervalMax, maxAttemptCount) => {
  try {
    const transactionTimestamp = Time.getUTCString(new Date())
    const knex = Db.getKnex()
    await knex.transaction(async (trx) => {
      try {
        // Insert `transferForwarded` records for transfers found between the interval intervalMin <= intervalMax
        await knex.from(knex.raw('transferForwarded (transferId, expirationDate)')).transacting(trx)
          .insert(function () {
            this.from('transfer AS t')
              .innerJoin(knex('transferStateChange')
                .select('transferId')
                .max('transferStateChangeId AS maxTransferStateChangeId')
                .where('transferStateChangeId', '>', intervalMin)
                .andWhere('transferStateChangeId', '<=', intervalMax)
                .groupBy('transferId')
                .as('ts'), 'ts.transferId', 't.transferId'
              )
              .innerJoin('transferStateChange AS tsc', 'tsc.transferStateChangeId', 'ts.maxTransferStateChangeId')
              .leftJoin('transferForwarded AS tf', 'tf.transferId', 't.transferId')
              .whereNull('tf.transferId')
              .whereIn('tsc.transferStateId', [`${Enum.Transfers.TransferInternalState.RESERVED_FORWARDED}`])
              .select('t.transferId', 't.expirationDate')
          })
          .onConflict('transferId')
          .ignore()

        // Insert `fxTransferForwarded` records for fxTransfers found between the interval intervalMin <= intervalMax and related fxTransfers
        await knex.from(knex.raw('fxTransferForwarded (commitRequestId, expirationDate)')).transacting(trx)
          .insert(function () {
            this.from('fxTransfer AS ft')
              .innerJoin(knex('fxTransferStateChange')
                .select('commitRequestId')
                .max('fxTransferStateChangeId AS maxFxTransferStateChangeId')
                .where('fxTransferStateChangeId', '>', fxIntervalMin)
                .andWhere('fxTransferStateChangeId', '<=', fxIntervalMax)
                .groupBy('commitRequestId').as('fts'), 'fts.commitRequestId', 'ft.commitRequestId'
              )
              .innerJoin('fxTransferStateChange AS ftsc', 'ftsc.fxTransferStateChangeId', 'fts.maxFxTransferStateChangeId')
              .leftJoin('fxTransferForwarded AS ftf', 'ftf.commitRequestId', 'ft.commitRequestId')
              .whereNull('ftf.commitRequestId')
              .whereIn('ftsc.transferStateId', [
                `${Enum.Transfers.TransferInternalState.RESERVED_FORWARDED}`
              ])
              .select('ft.commitRequestId', 'ft.expirationDate')
          })
          .onConflict('commitRequestId')
          .ignore()
      } catch (err) {
        rethrow.rethrowDatabaseError(err)
      }
    }).catch((err) => {
      rethrow.rethrowDatabaseError(err)
    })

    const transferForwardedList = await _getTransferList(knex, 'transferForwarded', transactionTimestamp, maxAttemptCount)
    const fxTransferForwardedList = await _getFxTransferList(knex, 'fxTransferForwarded', transactionTimestamp, maxAttemptCount)

    return {
      transferForwardedList,
      fxTransferForwardedList
    }
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const incrementForwardedAttemptCount = async (transferId, isFxTransfer = false) => {
  try {
    const knex = Db.getKnex()
    const tableName = isFxTransfer ? 'fxTransferForwarded' : 'transferForwarded'
    const idColumn = isFxTransfer ? 'commitRequestId' : 'transferId'
    const idValue = isFxTransfer ? transferId : transferId

    return await knex(tableName)
      .where(idColumn, idValue)
      .increment('attemptCount', 1)
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const removeForwardedRecord = async (transferId, isFxTransfer = false) => {
  try {
    const knex = Db.getKnex()
    const tableName = isFxTransfer ? 'fxTransferForwarded' : 'transferForwarded'
    const idColumn = isFxTransfer ? 'commitRequestId' : 'transferId'

    return await knex(tableName)
      .where(idColumn, transferId)
      .delete()
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const transferStateAndPositionUpdate = async function (param1, enums, trx = null) {
  try {
    const knex = Db.getKnex()

    const trxFunction = async (trx) => {
      const transactionTimestamp = Time.getUTCString(new Date())
      const info = await knex('transfer AS t')
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

      if (param1.transferStateId === enums.transferState.COMMITTED ||
          param1.transferStateId === TransferInternalState.RESERVED_FORWARDED
      ) {
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
      const transferStateChangeId = await knex('transferStateChange')
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
            participantCurrencyId: info.drAccountId,
            transferStateChangeId,
            value: new MLNumber(info.drPositionValue).add(info.drAmount).toFixed(Config.AMOUNT.SCALE),
            change: info.drAmount,
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
            participantCurrencyId: info.crAccountId,
            transferStateChangeId,
            value: new MLNumber(info.crPositionValue).add(info.crAmount).toFixed(Config.AMOUNT.SCALE),
            change: info.crAmount,
            reservedValue: info.crReservedValue,
            createdDate: param1.createdDate
          })
          .transacting(trx)
      }
      return {
        transferStateChangeId,
        drPositionValue: new MLNumber(info.drPositionValue).add(info.drAmount).toFixed(Config.AMOUNT.SCALE),
        crPositionValue: new MLNumber(info.crPositionValue).add(info.crAmount).toFixed(Config.AMOUNT.SCALE)
      }
    }

    if (trx) {
      return await trxFunction(trx)
    } else {
      return await knex.transaction(trxFunction)
    }
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const updatePrepareReservedForwarded = async function (transferId) {
  try {
    const knex = Db.getKnex()
    return await knex('transferStateChange')
      .insert({
        transferId,
        transferStateId: TransferInternalState.RESERVED_FORWARDED,
        reason: null,
        createdDate: Time.getUTCString(new Date())
      })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const reconciliationTransferPrepare = async function (payload, transactionTimestamp, enums, trx = null) {
  try {
    const knex = Db.getKnex()

    const trxFunction = async (trx) => {
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

      // Get participantId based on participantCurrencyId
      const { participantId } = await knex('participantCurrency')
        .select('participantId')
        .where('participantCurrencyId', payload.participantCurrencyId)
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
          participantId: Config.HUB_ID,
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
          participantId,
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
    }

    if (trx) {
      await trxFunction(trx)
    } else {
      await knex.transaction(trxFunction)
    }
    return 0
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const reconciliationTransferReserve = async function (payload, transactionTimestamp, enums, trx = null) {
  try {
    const knex = Db.getKnex()

    const trxFunction = async (trx) => {
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
    }

    if (trx) {
      await trxFunction(trx)
    } else {
      await knex.transaction(trxFunction)
    }
    return 0
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const reconciliationTransferCommit = async function (payload, transactionTimestamp, enums, trx = null) {
  try {
    const knex = Db.getKnex()

    const trxFunction = async (trx) => {
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
    }

    if (trx) {
      await trxFunction(trx)
    } else {
      await knex.transaction(trxFunction)
    }
    return 0
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const reconciliationTransferAbort = async function (payload, transactionTimestamp, enums, trx = null) {
  try {
    const knex = Db.getKnex()

    const trxFunction = async (trx) => {
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
    }

    if (trx) {
      await trxFunction(trx)
    } else {
      await knex.transaction(trxFunction)
    }
    return 0
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const getTransferParticipant = async (participantName, transferId) => {
  try {
    return Db.from('participant').query(async (builder) => {
      return builder
        .where({
          'participant.name': participantName,
          'tp.transferId': transferId,
          'participant.isActive': 1
        })
        .innerJoin('transferParticipant AS tp', 'tp.participantId', 'participant.participantId')
        .select(
          'tp.*'
        )
    })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
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
    } catch (err) {
      logger.error('error in recordFundsIn:', err)
      rethrow.rethrowDatabaseError(err)
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
  reservedForwardedTransfers,
  incrementForwardedAttemptCount,
  removeForwardedRecord,
  transferStateAndPositionUpdate,
  reconciliationTransferPrepare,
  reconciliationTransferReserve,
  reconciliationTransferCommit,
  reconciliationTransferAbort,
  getTransferParticipant,
  recordFundsIn,
  updatePrepareReservedForwarded
}

module.exports = TransferFacade
