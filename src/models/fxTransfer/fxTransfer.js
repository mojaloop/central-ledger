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

 * Infitx
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 - Kevin Leyow <kevin.leyow@infitx.com>
 - Kalin Krustev <kalin.krustev@infitx.com>
 - Steven Oderayi <steven.oderayi@infitx.com>
 - Eugen Klymniuk <eugen.klymniuk@infitx.com>

 --------------

 ******/

const Metrics = require('@mojaloop/central-services-metrics')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { Enum, Util } = require('@mojaloop/central-services-shared')
const Time = require('@mojaloop/central-services-shared').Util.Time
const TransferEventAction = Enum.Events.Event.Action

const { logger } = require('../../shared/logger')
const { TABLE_NAMES } = require('../../shared/constants')
const Db = require('../../lib/db')
const participant = require('../participant/facade')
const ParticipantCachedModel = require('../participant/participantCached')
const TransferExtensionModel = require('./fxTransferExtension')
const rethrow = require('../../shared/rethrow')

const { TransferInternalState } = Enum.Transfers

const UnsupportedActionText = 'Unsupported action'

const getByCommitRequestId = async (commitRequestId) => {
  logger.debug('get fxTransfer by commitRequestId:', { commitRequestId })
  return Db.from(TABLE_NAMES.fxTransfer).findOne({ commitRequestId })
}

const getByDeterminingTransferId = async (determiningTransferId) => {
  logger.debug('get fxTransfers by determiningTransferId:', { determiningTransferId })
  return Db.from(TABLE_NAMES.fxTransfer).find({ determiningTransferId })
}

const saveFxTransfer = async (record) => {
  logger.debug('save fxTransfer record:', { record })
  return Db.from(TABLE_NAMES.fxTransfer).insert(record)
}

const getByIdLight = async (id) => {
  try {
    /** @namespace Db.fxTransfer **/
    return await Db.from(TABLE_NAMES.fxTransfer).query(async (builder) => {
      return builder
        .where({ 'fxTransfer.commitRequestId': id })
        .leftJoin('fxTransferStateChange AS tsc', 'tsc.commitRequestId', 'fxTransfer.commitRequestId')
        .leftJoin('transferState AS ts', 'ts.transferStateId', 'tsc.transferStateId')
        .leftJoin('fxTransferFulfilment AS tf', 'tf.commitRequestId', 'fxTransfer.commitRequestId')
        .select(
          'fxTransfer.*',
          'tsc.fxTransferStateChangeId',
          'tsc.transferStateId AS fxTransferState',
          'ts.enumeration AS fxTransferStateEnumeration',
          'ts.description as fxTransferStateDescription',
          'tsc.reason AS reason',
          'tsc.createdDate AS completedTimestamp',
          'fxTransfer.ilpCondition AS condition',
          'tf.ilpFulfilment AS fulfilment'
        )
        .orderBy('tsc.fxTransferStateChangeId', 'desc')
        .first()
    })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const getAllDetailsByCommitRequestId = async (commitRequestId) => {
  try {
    /** @namespace Db.fxTransfer **/
    return await Db.from('fxTransfer').query(async (builder) => {
      const transferResult = await builder
        .where({
          'fxTransfer.commitRequestId': commitRequestId,
          'tprt1.name': 'INITIATING_FSP',
          'tprt2.name': 'COUNTER_PARTY_FSP',
          'tprt3.name': 'COUNTER_PARTY_FSP',
          'fpct1.name': 'SOURCE',
          'fpct2.name': 'TARGET'
        })
        // INITIATING_FSP
        .innerJoin('fxTransferParticipant AS tp1', 'tp1.commitRequestId', 'fxTransfer.commitRequestId')
        .innerJoin('transferParticipantRoleType AS tprt1', 'tprt1.transferParticipantRoleTypeId', 'tp1.transferParticipantRoleTypeId')
        .innerJoin('participant AS da', 'da.participantId', 'tp1.participantId')
        // COUNTER_PARTY_FSP SOURCE currency
        .innerJoin('fxTransferParticipant AS tp21', 'tp21.commitRequestId', 'fxTransfer.commitRequestId')
        .innerJoin('transferParticipantRoleType AS tprt2', 'tprt2.transferParticipantRoleTypeId', 'tp21.transferParticipantRoleTypeId')
        .innerJoin('fxParticipantCurrencyType AS fpct1', 'fpct1.fxParticipantCurrencyTypeId', 'tp21.fxParticipantCurrencyTypeId')
        .innerJoin('participant AS ca', 'ca.participantId', 'tp21.participantId')
        .leftJoin('participantCurrency AS pc21', 'pc21.participantCurrencyId', 'tp21.participantCurrencyId')
        // COUNTER_PARTY_FSP TARGET currency
        .innerJoin('fxTransferParticipant AS tp22', 'tp22.commitRequestId', 'fxTransfer.commitRequestId')
        .innerJoin('transferParticipantRoleType AS tprt3', 'tprt3.transferParticipantRoleTypeId', 'tp22.transferParticipantRoleTypeId')
        .innerJoin('fxParticipantCurrencyType AS fpct2', 'fpct2.fxParticipantCurrencyTypeId', 'tp22.fxParticipantCurrencyTypeId')
        // .innerJoin('participantCurrency AS pc22', 'pc22.participantCurrencyId', 'tp22.participantCurrencyId')
        // OTHER JOINS
        .leftJoin('fxTransferStateChange AS tsc', 'tsc.commitRequestId', 'fxTransfer.commitRequestId')
        .leftJoin('transferState AS ts', 'ts.transferStateId', 'tsc.transferStateId')
        .leftJoin('fxTransferFulfilment AS tf', 'tf.commitRequestId', 'fxTransfer.commitRequestId')
        // .leftJoin('transferError as te', 'te.commitRequestId', 'transfer.commitRequestId') // currently transferError.transferId is PK ensuring one error per transferId
        .select(
          'fxTransfer.*',
          'da.participantId AS initiatingFspParticipantId',
          'da.name AS initiatingFspName',
          'da.isProxy AS initiatingFspIsProxy',
          // 'pc21.participantCurrencyId AS counterPartyFspSourceParticipantCurrencyId',
          // 'pc22.participantCurrencyId AS counterPartyFspTargetParticipantCurrencyId',
          'tp21.participantCurrencyId AS counterPartyFspSourceParticipantCurrencyId',
          'tp22.participantCurrencyId AS counterPartyFspTargetParticipantCurrencyId',
          'ca.participantId AS counterPartyFspParticipantId',
          'ca.name AS counterPartyFspName',
          'ca.isProxy AS counterPartyFspIsProxy',
          'tsc.fxTransferStateChangeId',
          'tsc.transferStateId AS transferState',
          'tsc.reason AS reason',
          'tsc.createdDate AS completedTimestamp',
          'ts.enumeration as transferStateEnumeration',
          'ts.description as transferStateDescription',
          'tf.ilpFulfilment AS fulfilment'
        )
        .orderBy('tsc.fxTransferStateChangeId', 'desc')
        .first()
      if (transferResult) {
        transferResult.extensionList = await TransferExtensionModel.getByCommitRequestId(commitRequestId)
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
    logger.warn('error in getAllDetailsByCommitRequestId', err)
    rethrow.rethrowDatabaseError(err)
  }
}

// For proxied fxTransfers and transfers in a regional and jurisdictional scenario, proxy participants
// are not expected to have a target currency account, so we need a slightly altered version of the above function.
const getAllDetailsByCommitRequestIdForProxiedFxTransfer = async (commitRequestId) => {
  try {
    /** @namespace Db.fxTransfer **/
    return await Db.from('fxTransfer').query(async (builder) => {
      const transferResult = await builder
        .where({
          'fxTransfer.commitRequestId': commitRequestId,
          'tprt1.name': 'INITIATING_FSP',
          'tprt2.name': 'COUNTER_PARTY_FSP',
          'fpct1.name': 'SOURCE'
        })
        // INITIATING_FSP
        .innerJoin('fxTransferParticipant AS tp1', 'tp1.commitRequestId', 'fxTransfer.commitRequestId')
        .leftJoin('externalParticipant AS ep1', 'ep1.externalParticipantId', 'tp1.externalParticipantId')
        .innerJoin('transferParticipantRoleType AS tprt1', 'tprt1.transferParticipantRoleTypeId', 'tp1.transferParticipantRoleTypeId')
        .innerJoin('participant AS da', 'da.participantId', 'tp1.participantId')
        // COUNTER_PARTY_FSP SOURCE currency
        .innerJoin('fxTransferParticipant AS tp21', 'tp21.commitRequestId', 'fxTransfer.commitRequestId')
        .leftJoin('externalParticipant AS ep2', 'ep2.externalParticipantId', 'tp21.externalParticipantId')
        .innerJoin('transferParticipantRoleType AS tprt2', 'tprt2.transferParticipantRoleTypeId', 'tp21.transferParticipantRoleTypeId')
        .innerJoin('fxParticipantCurrencyType AS fpct1', 'fpct1.fxParticipantCurrencyTypeId', 'tp21.fxParticipantCurrencyTypeId')
        .innerJoin('participant AS ca', 'ca.participantId', 'tp21.participantId')
        .leftJoin('participantCurrency AS pc21', 'pc21.participantCurrencyId', 'tp21.participantCurrencyId')
        // .innerJoin('participantCurrency AS pc22', 'pc22.participantCurrencyId', 'tp22.participantCurrencyId')
        // OTHER JOINS
        .leftJoin('fxTransferStateChange AS tsc', 'tsc.commitRequestId', 'fxTransfer.commitRequestId')
        .leftJoin('transferState AS ts', 'ts.transferStateId', 'tsc.transferStateId')
        .leftJoin('fxTransferFulfilment AS tf', 'tf.commitRequestId', 'fxTransfer.commitRequestId')
        // .leftJoin('transferError as te', 'te.commitRequestId', 'transfer.commitRequestId') // currently transferError.transferId is PK ensuring one error per transferId
        .select(
          'fxTransfer.*',
          'da.participantId AS initiatingFspParticipantId',
          'da.name AS initiatingFspName',
          'da.isProxy AS initiatingFspIsProxy',
          // 'pc21.participantCurrencyId AS counterPartyFspSourceParticipantCurrencyId',
          // 'pc22.participantCurrencyId AS counterPartyFspTargetParticipantCurrencyId',
          'tp21.participantCurrencyId AS counterPartyFspSourceParticipantCurrencyId',
          'ca.participantId AS counterPartyFspParticipantId',
          'ca.name AS counterPartyFspName',
          'ca.isProxy AS counterPartyFspIsProxy',
          'tsc.fxTransferStateChangeId',
          'tsc.transferStateId AS transferState',
          'tsc.reason AS reason',
          'tsc.createdDate AS completedTimestamp',
          'ts.enumeration as transferStateEnumeration',
          'ts.description as transferStateDescription',
          'tf.ilpFulfilment AS fulfilment',
          'ep1.name AS externalInitiatingFspName',
          'ep2.name AS externalCounterPartyFspName'
        )
        .orderBy('tsc.fxTransferStateChangeId', 'desc')
        .first()

      if (transferResult) {
        transferResult.extensionList = await TransferExtensionModel.getByCommitRequestId(commitRequestId)
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
    logger.warn('error in getAllDetailsByCommitRequestIdForProxiedFxTransfer', err)
    rethrow.rethrowDatabaseError(err)
  }
}

const getParticipant = async (name, currency) =>
  participant.getByNameAndCurrency(name, currency, Enum.Accounts.LedgerAccountType.POSITION)

/**
 * Saves prepare fxTransfer details to DB.
 *
 * @param {Object} payload - Message payload.
 * @param {string | null} stateReason - Validation failure reasons.
 * @param {Boolean} hasPassedValidation - Is fxTransfer prepare validation passed.
 * @param {DeterminingTransferCheckResult} determiningTransferCheckResult - Determining transfer check result.
 * @param {ProxyObligation} proxyObligation - The proxy obligation
 * @returns {Promise<void>}
 */
const savePreparedRequest = async (
  payload,
  stateReason,
  hasPassedValidation,
  determiningTransferCheckResult,
  proxyObligation
) => {
  const histTimerSaveFxTransferEnd = Metrics.getHistogram(
    'model_fx_transfer',
    'facade_saveFxTransferPrepared - Metrics for transfer model',
    ['success', 'queryName']
  ).startTimer()

  // Substitute out of scheme participants with their proxy representatives
  const initiatingFsp = proxyObligation.isInitiatingFspProxy
    ? proxyObligation.initiatingFspProxyOrParticipantId.proxyId
    : payload.initiatingFsp
  const counterPartyFsp = proxyObligation.isCounterPartyFspProxy
    ? proxyObligation.counterPartyFspProxyOrParticipantId.proxyId
    : payload.counterPartyFsp

  // If creditor(counterPartyFsp) is a proxy in a jurisdictional scenario,
  // they would not hold a position account for the target currency,
  // so we skip adding records of the target currency for the creditor.
  try {
    const [initiatingParticipant, counterParticipant1, counterParticipant2] = await Promise.all([
      ParticipantCachedModel.getByName(initiatingFsp),
      getParticipant(counterPartyFsp, payload.sourceAmount.currency),
      !proxyObligation.isCounterPartyFspProxy ? getParticipant(counterPartyFsp, payload.targetAmount.currency) : null
    ])

    const fxTransferRecord = {
      commitRequestId: payload.commitRequestId,
      determiningTransferId: payload.determiningTransferId,
      sourceAmount: payload.sourceAmount.amount,
      sourceCurrency: payload.sourceAmount.currency,
      targetAmount: payload.targetAmount.amount,
      targetCurrency: payload.targetAmount.currency,
      ilpCondition: payload.condition,
      expirationDate: Util.Time.getUTCString(new Date(payload.expiration))
    }

    const fxTransferStateChangeRecord = {
      commitRequestId: payload.commitRequestId,
      transferStateId: hasPassedValidation ? TransferInternalState.RECEIVED_PREPARE : TransferInternalState.INVALID,
      reason: stateReason,
      createdDate: Util.Time.getUTCString(new Date())
    }

    const initiatingParticipantRecord = {
      commitRequestId: payload.commitRequestId,
      participantId: initiatingParticipant.participantId,
      participantCurrencyId: null,
      amount: payload.sourceAmount.amount,
      transferParticipantRoleTypeId: Enum.Accounts.TransferParticipantRoleType.INITIATING_FSP,
      ledgerEntryTypeId: Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE
    }
    if (proxyObligation.isInitiatingFspProxy) {
      initiatingParticipantRecord.externalParticipantId = await participant
        .getExternalParticipantIdByNameOrCreate(proxyObligation.initiatingFspProxyOrParticipantId)
    }

    const counterPartyParticipantRecord1 = {
      commitRequestId: payload.commitRequestId,
      participantId: counterParticipant1.participantId,
      participantCurrencyId: counterParticipant1.participantCurrencyId,
      amount: -payload.sourceAmount.amount,
      transferParticipantRoleTypeId: Enum.Accounts.TransferParticipantRoleType.COUNTER_PARTY_FSP,
      fxParticipantCurrencyTypeId: Enum.Fx.FxParticipantCurrencyType.SOURCE,
      ledgerEntryTypeId: Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE
    }
    if (proxyObligation.isCounterPartyFspProxy) {
      counterPartyParticipantRecord1.externalParticipantId = await participant
        .getExternalParticipantIdByNameOrCreate(proxyObligation.counterPartyFspProxyOrParticipantId)
    }

    let counterPartyParticipantRecord2 = null
    if (!proxyObligation.isCounterPartyFspProxy) {
      counterPartyParticipantRecord2 = {
        commitRequestId: payload.commitRequestId,
        participantId: counterParticipant2.participantId,
        participantCurrencyId: counterParticipant2.participantCurrencyId,
        amount: -payload.targetAmount.amount,
        transferParticipantRoleTypeId: Enum.Accounts.TransferParticipantRoleType.COUNTER_PARTY_FSP,
        fxParticipantCurrencyTypeId: Enum.Fx.FxParticipantCurrencyType.TARGET,
        ledgerEntryTypeId: Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE
      }
    }

    const knex = await Db.getKnex()
    if (hasPassedValidation) {
      const histTimerSaveTranferTransactionValidationPassedEnd = Metrics.getHistogram(
        'model_fx_transfer',
        'facade_saveFxTransferPrepared_transaction - Metrics for transfer model',
        ['success', 'queryName']
      ).startTimer()
      return await knex.transaction(async (trx) => {
        try {
          await knex(TABLE_NAMES.fxTransfer).transacting(trx).insert(fxTransferRecord)
          await knex(TABLE_NAMES.fxTransferParticipant).transacting(trx).insert(initiatingParticipantRecord)
          await knex(TABLE_NAMES.fxTransferParticipant).transacting(trx).insert(counterPartyParticipantRecord1)
          if (!proxyObligation.isCounterPartyFspProxy) {
            await knex(TABLE_NAMES.fxTransferParticipant).transacting(trx).insert(counterPartyParticipantRecord2)
          }
          initiatingParticipantRecord.name = payload.initiatingFsp
          counterPartyParticipantRecord1.name = payload.counterPartyFsp
          if (!proxyObligation.isCounterPartyFspProxy) {
            counterPartyParticipantRecord2.name = payload.counterPartyFsp
          }

          await knex(TABLE_NAMES.fxTransferStateChange).transacting(trx).insert(fxTransferStateChangeRecord)
          histTimerSaveTranferTransactionValidationPassedEnd({ success: true, queryName: 'facade_saveFxTransferPrepared_transaction' })
        } catch (err) {
          histTimerSaveTranferTransactionValidationPassedEnd({ success: false, queryName: 'facade_saveFxTransferPrepared_transaction' })
          rethrow.rethrowDatabaseError(err)
        }
      })
    } else {
      const queryName = 'facade_saveFxTransferPrepared_no_validation'
      const histTimerNoValidationEnd = Metrics.getHistogram(
        'model_fx_transfer',
        `${queryName} - Metrics for fxTransfer model`,
        ['success', 'queryName']
      ).startTimer()
      await knex(TABLE_NAMES.fxTransfer).insert(fxTransferRecord)

      try {
        await knex(TABLE_NAMES.fxTransferParticipant).insert(initiatingParticipantRecord)
      } catch (err) {
        logger.warn(`Payer fxTransferParticipant insert error: ${err.message}`)
        histTimerNoValidationEnd({ success: false, queryName })
      }

      try {
        await knex(TABLE_NAMES.fxTransferParticipant).insert(counterPartyParticipantRecord1)
        if (!proxyObligation.isCounterPartyFspProxy) {
          await knex(TABLE_NAMES.fxTransferParticipant).insert(counterPartyParticipantRecord2)
        }
      } catch (err) {
        histTimerNoValidationEnd({ success: false, queryName })
        logger.warn(`Payee fxTransferParticipant insert error: ${err.message}`)
      }
      initiatingParticipantRecord.name = payload.initiatingFsp
      counterPartyParticipantRecord1.name = payload.counterPartyFsp
      if (!proxyObligation.isCounterPartyFspProxy) {
        counterPartyParticipantRecord2.name = payload.counterPartyFsp
      }

      try {
        await knex(TABLE_NAMES.fxTransferStateChange).insert(fxTransferStateChangeRecord)
        histTimerNoValidationEnd({ success: true, queryName })
      } catch (err) {
        logger.warn(`fxTransferStateChange insert error: ${err.message}`)
        histTimerNoValidationEnd({ success: false, queryName })
      }
    }
    histTimerSaveFxTransferEnd({ success: true, queryName: 'transfer_model_facade_saveTransferPrepared' })
  } catch (err) {
    logger.warn('error in savePreparedRequest', err)
    histTimerSaveFxTransferEnd({ success: false, queryName: 'transfer_model_facade_saveTransferPrepared' })
    rethrow.rethrowDatabaseError(err)
  }
}

const saveFxFulfilResponse = async (commitRequestId, payload, action, fspiopError) => {
  const histTimerSaveFulfilResponseEnd = Metrics.getHistogram(
    'fx_model_transfer',
    'facade_saveFxFulfilResponse - Metrics for fxTransfer model',
    ['success', 'queryName']
  ).startTimer()

  let state
  let isFulfilment = false
  let isError = false
  // const errorCode = fspiopError && fspiopError.errorInformation && fspiopError.errorInformation.errorCode
  const errorDescription = fspiopError && fspiopError.errorInformation && fspiopError.errorInformation.errorDescription
  let extensionList
  switch (action) {
    case TransferEventAction.FX_COMMIT:
    case TransferEventAction.FX_RESERVE:
    case TransferEventAction.FX_FORWARDED:
      state = TransferInternalState.RECEIVED_FULFIL_DEPENDENT
      extensionList = payload && payload.extensionList
      isFulfilment = true
      break
    case TransferEventAction.FX_REJECT:
      state = TransferInternalState.RECEIVED_REJECT
      extensionList = payload && payload.extensionList
      isFulfilment = true
      break

    case TransferEventAction.FX_ABORT_VALIDATION:
    case TransferEventAction.FX_ABORT:
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

  const fxTransferFulfilmentRecord = {
    commitRequestId,
    ilpFulfilment: payload.fulfilment || null,
    completedDate: completedTimestamp,
    isValid: !fspiopError,
    settlementWindowId: null,
    createdDate: transactionTimestamp
  }
  let fxTransferExtensionRecordsList = []
  if (extensionList && extensionList.extension) {
    fxTransferExtensionRecordsList = extensionList.extension.map(ext => {
      return {
        commitRequestId,
        key: ext.key,
        value: ext.value,
        isFulfilment,
        isError
      }
    })
  }
  const fxTransferStateChangeRecord = {
    commitRequestId,
    transferStateId: state,
    reason: errorDescription,
    createdDate: transactionTimestamp
  }

  try {
    /** @namespace Db.getKnex **/
    const knex = await Db.getKnex()
    const histTFxFulfilResponseValidationPassedEnd = Metrics.getHistogram(
      'model_transfer',
      'facade_saveTransferPrepared_transaction - Metrics for transfer model',
      ['success', 'queryName']
    ).startTimer()

    await knex.transaction(async (trx) => {
      try {
        if (!fspiopError && [TransferEventAction.FX_COMMIT, TransferEventAction.FX_RESERVE].includes(action)) {
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
          fxTransferFulfilmentRecord.settlementWindowId = res[0].settlementWindowId
          logger.debug('saveFxFulfilResponse::settlementWindowId')
        }
        if (isFulfilment) {
          await knex('fxTransferFulfilment').transacting(trx).insert(fxTransferFulfilmentRecord)
          result.fxTransferFulfilmentRecord = fxTransferFulfilmentRecord
          logger.debug('saveFxFulfilResponse::fxTransferFulfilment')
        }
        if (fxTransferExtensionRecordsList.length > 0) {
          await knex('fxTransferExtension').transacting(trx).insert(fxTransferExtensionRecordsList)
          result.fxTransferExtensionRecordsList = fxTransferExtensionRecordsList
          logger.debug('saveFxFulfilResponse::transferExtensionRecordsList')
        }
        await knex('fxTransferStateChange').transacting(trx).insert(fxTransferStateChangeRecord)
        result.fxTransferStateChangeRecord = fxTransferStateChangeRecord
        logger.debug('saveFxFulfilResponse::fxTransferStateChange')
        histTFxFulfilResponseValidationPassedEnd({ success: true, queryName: 'facade_saveFxFulfilResponse_transaction' })
        result.savePayeeTransferResponseExecuted = true
        logger.debug('saveFxFulfilResponse::success')
      } catch (err) {
        histTFxFulfilResponseValidationPassedEnd({ success: false, queryName: 'facade_saveFxFulfilResponse_transaction' })
        logger.error('saveFxFulfilResponse::failure')
        rethrow.rethrowDatabaseError(err)
      }
    })
    histTimerSaveFulfilResponseEnd({ success: true, queryName: 'facade_saveFulfilResponse' })
    return result
  } catch (err) {
    logger.warn('error in saveFxFulfilResponse', err)
    histTimerSaveFulfilResponseEnd({ success: false, queryName: 'facade_saveFulfilResponse' })
    rethrow.rethrowDatabaseError(err)
  }
}

const updateFxPrepareReservedForwarded = async function (commitRequestId) {
  try {
    const knex = await Db.getKnex()
    return await knex('fxTransferStateChange')
      .insert({
        commitRequestId,
        transferStateId: TransferInternalState.RESERVED_FORWARDED,
        reason: null,
        createdDate: Time.getUTCString(new Date())
      })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const getFxTransferParticipant = async (participantName, commitRequestId) => {
  try {
    return Db.from('participant').query(async (builder) => {
      return builder
        .where({
          'ftp.commitRequestId': commitRequestId,
          'participant.name': participantName,
          'participant.isActive': 1
        })
        .innerJoin('fxTransferParticipant AS ftp', 'ftp.participantId', 'participant.participantId')
        .select(
          'ftp.*'
        )
    })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

module.exports = {
  getByCommitRequestId,
  getByDeterminingTransferId,
  getByIdLight,
  getAllDetailsByCommitRequestId,
  getAllDetailsByCommitRequestIdForProxiedFxTransfer,
  getFxTransferParticipant,
  savePreparedRequest,
  saveFxFulfilResponse,
  saveFxTransfer,
  updateFxPrepareReservedForwarded
}
