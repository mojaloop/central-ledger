const Metrics = require('@mojaloop/central-services-metrics')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { Enum, Util } = require('@mojaloop/central-services-shared')
const Time = require('@mojaloop/central-services-shared').Util.Time
const TransferEventAction = Enum.Events.Event.Action

const Db = require('../../lib/db')
const participant = require('../participant/facade')
const { TABLE_NAMES } = require('../../shared/constants')
const { logger } = require('../../shared/logger')

const { TransferInternalState } = Enum.Transfers

const UnsupportedActionText = 'Unsupported action'

const getByCommitRequestId = async (commitRequestId) => {
  logger.debug(`get fx transfer (commitRequestId=${commitRequestId})`)
  return Db.from(TABLE_NAMES.fxTransfer).findOne({ commitRequestId })
}

const getByDeterminingTransferId = async (determiningTransferId) => {
  logger.debug(`get fx transfer (determiningTransferId=${determiningTransferId})`)
  return Db.from(TABLE_NAMES.fxTransfer).findOne({ determiningTransferId })
}

const saveFxTransfer = async (record) => {
  logger.debug('save fx transfer' + record.toString())
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
        .select(
          'fxTransfer.*',
          'tsc.fxTransferStateChangeId',
          'tsc.transferStateId AS fxTransferState',
          'ts.enumeration AS fxTransferStateEnumeration',
          'ts.description as fxTransferStateDescription',
          'tsc.reason AS reason',
          'tsc.createdDate AS completedTimestamp',
          'fxTransfer.ilpCondition AS condition'
        )
        .orderBy('tsc.fxTransferStateChangeId', 'desc')
        .first()
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getAllDetailsByCommitRequestId = async (commitRequestId) => {
  try {
    /** @namespace Db.fxTransfer **/
    return await Db.from('fxTransfer').query(async (builder) => {
      const transferResult = await builder
        .where({
          'fxTransfer.commitRequestId': commitRequestId,
          'tprt1.name': 'INITIATING_FSP', // TODO: refactor to use transferParticipantRoleTypeId
          'tprt2.name': 'COUNTER_PARTY_FSP',
          'tprt3.name': 'COUNTER_PARTY_FSP',
          'fpct1.name': 'SOURCE',
          'fpct2.name': 'TARGET'
        })
        .whereRaw('pc1.currencyId = fxTransfer.sourceCurrency')
        // .whereRaw('pc21.currencyId = fxTransfer.sourceCurrency')
        // .whereRaw('pc22.currencyId = fxTransfer.targetCurrency')
        // INITIATING_FSP
        .innerJoin('fxTransferParticipant AS tp1', 'tp1.commitRequestId', 'fxTransfer.commitRequestId')
        .innerJoin('transferParticipantRoleType AS tprt1', 'tprt1.transferParticipantRoleTypeId', 'tp1.transferParticipantRoleTypeId')
        .innerJoin('participantCurrency AS pc1', 'pc1.participantCurrencyId', 'tp1.participantCurrencyId')
        .innerJoin('participant AS da', 'da.participantId', 'pc1.participantId')
        // COUNTER_PARTY_FSP SOURCE currency
        .innerJoin('fxTransferParticipant AS tp21', 'tp21.commitRequestId', 'fxTransfer.commitRequestId')
        .innerJoin('transferParticipantRoleType AS tprt2', 'tprt2.transferParticipantRoleTypeId', 'tp21.transferParticipantRoleTypeId')
        .innerJoin('fxParticipantCurrencyType AS fpct1', 'fpct1.fxParticipantCurrencyTypeId', 'tp21.fxParticipantCurrencyTypeId')
        .innerJoin('participantCurrency AS pc21', 'pc21.participantCurrencyId', 'tp21.participantCurrencyId')
        .innerJoin('participant AS ca', 'ca.participantId', 'pc21.participantId')
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
          'pc1.participantCurrencyId AS initiatingFspParticipantCurrencyId',
          'tp1.amount AS initiatingFspAmount',
          'da.participantId AS initiatingFspParticipantId',
          'da.name AS initiatingFspName',
          // 'pc21.participantCurrencyId AS counterPartyFspSourceParticipantCurrencyId',
          // 'pc22.participantCurrencyId AS counterPartyFspTargetParticipantCurrencyId',
          'tp21.participantCurrencyId AS counterPartyFspSourceParticipantCurrencyId',
          'tp22.participantCurrencyId AS counterPartyFspTargetParticipantCurrencyId',
          'ca.participantId AS counterPartyFspParticipantId',
          'ca.name AS counterPartyFspName',
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
        // transferResult.extensionList = await TransferExtensionModel.getByTransferId(id) // TODO: check if this is needed
        // if (transferResult.errorCode && transferResult.transferStateEnumeration === Enum.Transfers.TransferState.ABORTED) {
        //   if (!transferResult.extensionList) transferResult.extensionList = []
        //   transferResult.extensionList.push({
        //     key: 'cause',
        //     value: `${transferResult.errorCode}: ${transferResult.errorDescription}`.substr(0, 128)
        //   })
        // }
        transferResult.isTransferReadModel = true
      }
      return transferResult
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getParticipant = async (name, currency) =>
  participant.getByNameAndCurrency(name, currency, Enum.Accounts.LedgerAccountType.POSITION)

const savePreparedRequest = async (payload, stateReason, hasPassedValidation) => {
  const histTimerSaveFxTransferEnd = Metrics.getHistogram(
    'model_fx_transfer',
    'facade_saveFxTransferPrepared - Metrics for transfer model',
    ['success', 'queryName']
  ).startTimer()

  try {
    const [initiatingParticipant, counterParticipant1, counterParticipant2] = await Promise.all([
      getParticipant(payload.initiatingFsp, payload.sourceAmount.currency),
      getParticipant(payload.counterPartyFsp, payload.sourceAmount.currency),
      getParticipant(payload.counterPartyFsp, payload.targetAmount.currency)
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
      participantCurrencyId: initiatingParticipant.participantCurrencyId,
      amount: payload.sourceAmount.amount,
      transferParticipantRoleTypeId: Enum.Accounts.TransferParticipantRoleType.INITIATING_FSP,
      ledgerEntryTypeId: Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE
    }

    const counterPartyParticipantRecord1 = {
      commitRequestId: payload.commitRequestId,
      participantCurrencyId: counterParticipant1.participantCurrencyId,
      amount: -payload.sourceAmount.amount,
      transferParticipantRoleTypeId: Enum.Accounts.TransferParticipantRoleType.COUNTER_PARTY_FSP,
      fxParticipantCurrencyTypeId: Enum.Fx.FxParticipantCurrencyType.SOURCE,
      ledgerEntryTypeId: Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE
    }

    const counterPartyParticipantRecord2 = {
      commitRequestId: payload.commitRequestId,
      participantCurrencyId: counterParticipant2.participantCurrencyId,
      amount: -payload.targetAmount.amount,
      transferParticipantRoleTypeId: Enum.Accounts.TransferParticipantRoleType.COUNTER_PARTY_FSP,
      fxParticipantCurrencyTypeId: Enum.Fx.FxParticipantCurrencyType.TARGET,
      ledgerEntryTypeId: Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE
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
          await knex(TABLE_NAMES.fxTransferParticipant).transacting(trx).insert(counterPartyParticipantRecord2)
          initiatingParticipantRecord.name = payload.initiatingFsp
          counterPartyParticipantRecord1.name = payload.counterPartyFsp
          counterPartyParticipantRecord2.name = payload.counterPartyFsp

          await knex(TABLE_NAMES.fxTransferStateChange).transacting(trx).insert(fxTransferStateChangeRecord)
          await trx.commit()
          histTimerSaveTranferTransactionValidationPassedEnd({ success: true, queryName: 'facade_saveFxTransferPrepared_transaction' })
        } catch (err) {
          await trx.rollback()
          histTimerSaveTranferTransactionValidationPassedEnd({ success: false, queryName: 'facade_saveFxTransferPrepared_transaction' })
          throw err
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
        await knex(TABLE_NAMES.fxTransferParticipant).insert(counterPartyParticipantRecord2)
      } catch (err) {
        histTimerNoValidationEnd({ success: false, queryName })
        logger.warn(`Payee fxTransferParticipant insert error: ${err.message}`)
      }
      initiatingParticipantRecord.name = payload.initiatingFsp
      counterPartyParticipantRecord1.name = payload.counterPartyFsp
      counterPartyParticipantRecord2.name = payload.counterPartyFsp

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
    histTimerSaveFxTransferEnd({ success: false, queryName: 'transfer_model_facade_saveTransferPrepared' })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

// todo: clarify this code
const saveFxFulfilResponse = async (commitRequestId, payload, action, fspiopError) => {
  const histTimerSaveFulfilResponseEnd = Metrics.getHistogram(
    'fx_model_transfer',
    'facade_saveFxFulfilResponse - Metrics for fxTransfer model',
    ['success', 'queryName']
  ).startTimer()

  let state
  let isFulfilment = false
  // const isError = false
  // const errorCode = fspiopError && fspiopError.errorInformation && fspiopError.errorInformation.errorCode
  const errorDescription = fspiopError && fspiopError.errorInformation && fspiopError.errorInformation.errorDescription
  // let extensionList
  switch (action) {
    // TODO: Need to check if these are relevant for FX transfers
    // case TransferEventAction.COMMIT:
    case TransferEventAction.FX_RESERVE:
      state = TransferInternalState.RECEIVED_FULFIL
      // extensionList = payload && payload.extensionList
      isFulfilment = true
      break
    case TransferEventAction.FX_REJECT:
      state = TransferInternalState.RECEIVED_REJECT
      // extensionList = payload && payload.extensionList
      isFulfilment = true
      break
    // TODO: Need to check if these are relevant for FX transfers
    // case TransferEventAction.ABORT_VALIDATION:
    case TransferEventAction.FX_ABORT:
      state = TransferInternalState.RECEIVED_ERROR
      // extensionList = payload && payload.errorInformation && payload.errorInformation.extensionList
      // isError = true
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
  // let fxTransferExtensionRecordsList = []
  // if (extensionList && extensionList.extension) {
  //   fxTransferExtensionRecordsList = extensionList.extension.map(ext => {
  //     return {
  //       commitRequestId,
  //       key: ext.key,
  //       value: ext.value,
  //       isFulfilment,
  //       isError
  //     }
  //   })
  // }
  const fxTransferStateChangeRecord = {
    commitRequestId,
    transferStateId: state,
    reason: errorDescription,
    createdDate: transactionTimestamp
  }
  // const fxTransferErrorRecord = {
  //   commitRequestId,
  //   fxTransferStateChangeId: null,
  //   errorCode,
  //   errorDescription,
  //   createdDate: transactionTimestamp
  // }

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
        // TODO: Need to create a new table for fxExtensions and enable the following
        // if (fxTransferExtensionRecordsList.length > 0) {
        //   // ###! CAN BE DONE THROUGH A BATCH
        //   for (const fxTransferExtension of fxTransferExtensionRecordsList) {
        //     await knex('fxTransferExtension').transacting(trx).insert(fxTransferExtension)
        //   }
        //   // ###!
        //   result.fxTransferExtensionRecordsList = fxTransferExtensionRecordsList
        //   logger.debug('saveFxFulfilResponse::transferExtensionRecordsList')
        // }
        await knex('fxTransferStateChange').transacting(trx).insert(fxTransferStateChangeRecord)
        result.fxTransferStateChangeRecord = fxTransferStateChangeRecord
        logger.debug('saveFxFulfilResponse::fxTransferStateChange')
        // TODO: Need to handle the following incase of error
        // if (fspiopError) {
        //   const insertedTransferStateChange = await knex('fxTransferStateChange').transacting(trx)
        //     .where({ commitRequestId })
        //     .forUpdate().first().orderBy('fxTransferStateChangeId', 'desc')
        //   fxTransferStateChangeRecord.fxTransferStateChangeId = insertedTransferStateChange.fxTransferStateChangeId
        //   fxTransferErrorRecord.fxTransferStateChangeId = insertedTransferStateChange.fxTransferStateChangeId
        //   await knex('transferError').transacting(trx).insert(fxTransferErrorRecord)
        //   result.fxTransferErrorRecord = fxTransferErrorRecord
        //   logger.debug('saveFxFulfilResponse::transferError')
        // }
        histTFxFulfilResponseValidationPassedEnd({ success: true, queryName: 'facade_saveFxFulfilResponse_transaction' })
        result.savePayeeTransferResponseExecuted = true
        logger.debug('saveFxFulfilResponse::success')
      } catch (err) {
        await trx.rollback()
        histTFxFulfilResponseValidationPassedEnd({ success: false, queryName: 'facade_saveFxFulfilResponse_transaction' })
        logger.error('saveFxFulfilResponse::failure')
        throw err
      }
    })
    histTimerSaveFulfilResponseEnd({ success: true, queryName: 'facade_saveFulfilResponse' })
    return result
  } catch (err) {
    histTimerSaveFulfilResponseEnd({ success: false, queryName: 'facade_saveFulfilResponse' })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  getByCommitRequestId,
  getByDeterminingTransferId,
  getByIdLight,
  getAllDetailsByCommitRequestId,
  savePreparedRequest,
  saveFxFulfilResponse,
  saveFxTransfer
}
