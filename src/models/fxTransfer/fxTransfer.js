const Metrics = require('@mojaloop/central-services-metrics')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { Enum, Util } = require('@mojaloop/central-services-shared')

const Db = require('../../lib/db')
const participant = require('../participant/facade')
const { TABLE_NAMES } = require('../../shared/constants')
const { logger } = require('../../shared/logger')

const { TransferInternalState } = Enum.Transfers

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

const getParticipant = async (name, currency) =>
  participant.getByNameAndCurrency(name, currency, Enum.Accounts.LedgerAccountType.POSITION)

const savePreparedRequest = async (payload, stateReason = null, hasPassedValidation = true) => {
  const histTimerSaveFxTransferEnd = Metrics.getHistogram(
    'model_fx_transfer',
    'facade_saveFxTransferPrepared - Metrics for transfer model',
    ['success', 'queryName']
  ).startTimer()

  try {
    const [initiatingParticipant, counterParticipant] = await Promise.all([
      getParticipant(payload.initiatingFsp, payload.sourceAmount.currency),
      getParticipant(payload.counterPartyFsp, payload.targetAmount.currency)
    ])

    // todo: move all mappings to DTO
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

    const payerTransferParticipantRecord = {
      commitRequestId: payload.commitRequestId,
      participantCurrencyId: initiatingParticipant.participantCurrencyId,
      transferParticipantRoleTypeId: Enum.Accounts.TransferParticipantRoleType.INITIATING_FSP,
      ledgerEntryTypeId: Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE,
      amount: fxTransferRecord.sourceAmount
    }

    const payeeTransferParticipantRecord = {
      commitRequestId: payload.commitRequestId,
      participantCurrencyId: counterParticipant.participantCurrencyId,
      transferParticipantRoleTypeId: Enum.Accounts.TransferParticipantRoleType.COUNTER_PARTY_FSP,
      ledgerEntryTypeId: Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE,
      amount: -fxTransferRecord.sourceAmount // todo: think, how to define proper amount
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
          await knex(TABLE_NAMES.fxTransferParticipant).transacting(trx).insert(payerTransferParticipantRecord)
          await knex(TABLE_NAMES.fxTransferParticipant).transacting(trx).insert(payeeTransferParticipantRecord)
          payerTransferParticipantRecord.name = payload.initiatingFsp
          payeeTransferParticipantRecord.name = payload.counterPartyFsp

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
        await knex(TABLE_NAMES.fxTransferParticipant).insert(payerTransferParticipantRecord)
      } catch (err) {
        logger.warn(`Payer fxTransferParticipant insert error: ${err.message}`)
        histTimerNoValidationEnd({ success: false, queryName })
      }

      try {
        await knex(TABLE_NAMES.fxTransferParticipant).insert(payeeTransferParticipantRecord)
      } catch (err) {
        histTimerNoValidationEnd({ success: false, queryName })
        logger.warn(`Payee fxTransferParticipant insert error: ${err.message}`)
      }
      payerTransferParticipantRecord.name = payload.initiatingFsp
      payeeTransferParticipantRecord.name = payload.counterPartyFsp

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

module.exports = {
  getByIdLight,
  savePreparedRequest
}
