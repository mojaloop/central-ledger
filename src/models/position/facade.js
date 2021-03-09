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
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * @module src/models/position/
 */

const Db = require('../../lib/db')
const Enum = require('@mojaloop/central-services-shared').Enum
const participantFacade = require('../participant/facade')
const SettlementModelCached = require('../../models/settlement/settlementModelCached')
const Logger = require('@mojaloop/central-services-logger')
const Time = require('@mojaloop/central-services-shared').Util.Time
const MLNumber = require('@mojaloop/ml-number')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Config = require('../../lib/config')

const Metrics = require('@mojaloop/central-services-metrics')

const prepareChangeParticipantPositionTransaction = async (transferList) => {
  const histTimerChangeParticipantPositionEnd = Metrics.getHistogram(
    'model_position',
    'facade_prepareChangeParticipantPositionTransaction - Metrics for position model',
    ['success', 'queryName']
  ).startTimer()
  try {
    const knex = await Db.getKnex()
    const participantName = transferList[0].value.content.payload.payerFsp
    const currencyId = transferList[0].value.content.payload.amount.currency
    const settlementModel = await SettlementModelCached.getByLedgerAccountTypeId(Enum.Accounts.LedgerAccountType.POSITION)
    const participantCurrency = await participantFacade.getByNameAndCurrency(participantName, currencyId, Enum.Accounts.LedgerAccountType.POSITION)
    const settlementParticipantCurrency = await participantFacade.getByNameAndCurrency(participantName, currencyId, settlementModel.settlementAccountTypeId)
    const processedTransfers = {} // The list of processed transfers - so that we can store the additional information around the decision. Most importantly the "running" position
    const reservedTransfers = []
    const abortedTransfers = []
    const initialTransferStateChangePromises = []
    const transferIdList = []
    const limitAlarms = []
    let sumTransfersInBatch = 0
    const histTimerChangeParticipantPositionTransEnd = Metrics.getHistogram(
      'model_position',
      'facade_prepareChangeParticipantPositionTransaction_transaction - Metrics for position model',
      ['success', 'queryName']
    ).startTimer()
    await knex.transaction(async (trx) => {
      try {
        const transactionTimestamp = Time.getUTCString(new Date())
        for (const transfer of transferList) {
          // const initialTransferStateChangeList = await knex('transferStateChange').transacting(trx).whereIn('transferId', transferIdList).forUpdate().orderBy('transferStateChangeId', 'desc')
          // ^^^^^ this is how we want to get this later to reduce the DB queries into one.

          /*
          TODO Possibly the commented block of validations in this comment block will be validated with message validations for each topic
          (are they valid or not LIME messages and are they valid for the given topic)
           ====
           Since iterating over the list of transfers, validate here that each transfer is for the PayerFSP and Currency
           if (participantName !== transfer.value.content.payload.payerFSP)
             {} // log error for particular transfer because it should not be in this topic (and might be injected)
           if (currencyId != transfer.value.content.payload.payerFSP)
             {} // log error for particular transfer because it should not be in this topic (and might be injected)
           ====
           */

          const id = transfer.value.content.payload.transferId
          transferIdList.push(id)
          // DUPLICATE of TransferStateChangeModel getByTransferId
          initialTransferStateChangePromises.push(await knex('transferStateChange').transacting(trx).where('transferId', id).orderBy('transferStateChangeId', 'desc').first())
        }
        const histTimerinitialTransferStateChangeListEnd = Metrics.getHistogram(
          'model_position',
          'facade_prepareChangeParticipantPositionTransaction_transaction_initialTransferStateChangeList - Metrics for position model',
          ['success', 'queryName']
        ).startTimer()
        const initialTransferStateChangeList = await Promise.all(initialTransferStateChangePromises)
        histTimerinitialTransferStateChangeListEnd({ success: true, queryName: 'facade_prepareChangeParticipantPositionTransaction_transaction_initialTransferStateChangeList' })
        const histTimerTransferStateChangePrepareAndBatchInsertEnd = Metrics.getHistogram(
          'model_position',
          'facade_prepareChangeParticipantPositionTransaction_transaction_transferStateChangeBatchInsert - Metrics for position model',
          ['success', 'queryName']
        ).startTimer()
        for (const id in initialTransferStateChangeList) {
          const transferState = initialTransferStateChangeList[id]
          const transfer = transferList[id].value.content.payload
          const rawMessage = transferList[id]
          if (transferState.transferStateId === Enum.Transfers.TransferInternalState.RECEIVED_PREPARE) {
            transferState.transferStateChangeId = null
            transferState.transferStateId = Enum.Transfers.TransferState.RESERVED
            const transferAmount = new MLNumber(transfer.amount.amount) /* Just do this once, so add to reservedTransfers */
            reservedTransfers[transfer.transferId] = { transferState, transfer, rawMessage, transferAmount }
            sumTransfersInBatch = new MLNumber(sumTransfersInBatch).add(transferAmount).toFixed(Config.AMOUNT.SCALE)
          } else {
            transferState.transferStateChangeId = null
            transferState.transferStateId = Enum.Transfers.TransferInternalState.ABORTED_REJECTED
            transferState.reason = 'Transfer in incorrect state'
            abortedTransfers[transfer.transferId] = { transferState, transfer, rawMessage }
          }
        }
        const abortedTransferStateChangeList = Object.keys(abortedTransfers).length && Array.from(transferIdList.map(transferId => abortedTransfers[transferId].transferState))
        Object.keys(abortedTransferStateChangeList).length && await knex.batchInsert('transferStateChange', abortedTransferStateChangeList).transacting(trx)
        histTimerTransferStateChangePrepareAndBatchInsertEnd({ success: true, queryName: 'facade_prepareChangeParticipantPositionTransaction_transaction_transferStateChangeBatchInsert' })
        // Get the effective position for this participantCurrency at the start of processing the Batch
        // and reserved the total value of the transfers in the batch (sumTransfersInBatch)
        const histTimerUpdateEffectivePositionEnd = Metrics.getHistogram(
          'model_position',
          'facade_prepareChangeParticipantPositionTransaction_transaction_UpdateEffectivePosition - Metrics for position model',
          ['success', 'queryName']
        ).startTimer()
        const participantPositions = await knex('participantPosition')
          .transacting(trx)
          .whereIn('participantCurrencyId', [participantCurrency.participantCurrencyId, settlementParticipantCurrency.participantCurrencyId])
          .forUpdate()
          .select('*')
        const initialParticipantPosition = participantPositions.find(position => position.participantCurrencyId === participantCurrency.participantCurrencyId)
        const settlementParticipantPosition = participantPositions.find(position => position.participantCurrencyId === settlementParticipantCurrency.participantCurrencyId)
        const currentPosition = new MLNumber(initialParticipantPosition.value)
        const reservedPosition = new MLNumber(initialParticipantPosition.reservedValue)
        const effectivePosition = currentPosition.add(reservedPosition).toFixed(Config.AMOUNT.SCALE)
        initialParticipantPosition.reservedValue = new MLNumber(initialParticipantPosition.reservedValue).add(sumTransfersInBatch).toFixed(Config.AMOUNT.SCALE)
        initialParticipantPosition.changedDate = transactionTimestamp
        await knex('participantPosition').transacting(trx).where({ participantPositionId: initialParticipantPosition.participantPositionId }).update(initialParticipantPosition)
        histTimerUpdateEffectivePositionEnd({ success: true, queryName: 'facade_prepareChangeParticipantPositionTransaction_transaction_UpdateEffectivePosition' })
        // Get the actual position limit and calculate the available position for the transfers to use in this batch
        // Note: see optimisation decision notes to understand the justification for the algorithm
        const histTimerValidatePositionBatchEnd = Metrics.getHistogram(
          'model_position',
          'facade_prepareChangeParticipantPositionTransaction_transaction_ValidatePositionBatch - Metrics for position model',
          ['success', 'queryName']
        ).startTimer()
        const participantLimit = await participantFacade.getParticipantLimitByParticipantCurrencyLimit(participantCurrency.participantId, participantCurrency.currencyId, Enum.Accounts.LedgerAccountType.POSITION, Enum.Accounts.ParticipantLimitType.NET_DEBIT_CAP)
        // Calculate liquidity cover as per story OTC-651
        let liquidityCover
        if (settlementModel.settlementDelayId === Enum.Settlements.SettlementDelay.IMMEDIATE) {
          liquidityCover = new MLNumber(settlementParticipantPosition.value).add(new MLNumber(participantLimit.value))
        } else {
          liquidityCover = new MLNumber(participantLimit.value)
        }
        let availablePosition = liquidityCover.subtract(effectivePosition).toFixed(Config.AMOUNT.SCALE)
        /* Validate entire batch if availablePosition >= sumTransfersInBatch - the impact is that applying per transfer rules would require to be handled differently
           since further rules are expected we do not do this at this point
           As we enter this next step the order in which the transfer is processed against the Position is critical.
           Both positive and failure cases need to recorded in processing order
           This means that they should not be removed from the list, and the participantPosition
        */
        let sumReserved = 0 // Record the sum of the transfers we allow to progress to RESERVED
        for (const transferId in reservedTransfers) {
          const { transfer, transferState, rawMessage, transferAmount } = reservedTransfers[transferId]
          if (new MLNumber(availablePosition).toNumber() >= transferAmount.toNumber()) {
            availablePosition = new MLNumber(availablePosition).subtract(transferAmount).toFixed(Config.AMOUNT.SCALE)
            transferState.transferStateId = Enum.Transfers.TransferState.RESERVED
            sumReserved = new MLNumber(sumReserved).add(transferAmount).toFixed(Config.AMOUNT.SCALE) /* actually used */
          } else {
            transferState.transferStateId = Enum.Transfers.TransferInternalState.ABORTED_REJECTED
            transferState.reason = ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_INSUFFICIENT_LIQUIDITY.message
            rawMessage.value.content.payload = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_INSUFFICIENT_LIQUIDITY, null, null, null, rawMessage.value.content.payload.extensionList).toApiErrorObject(Config.ERROR_HANDLING)
          }
          const runningPosition = new MLNumber(currentPosition).add(sumReserved).toFixed(Config.AMOUNT.SCALE) /* effective position */
          const runningReservedValue = new MLNumber(sumTransfersInBatch).subtract(sumReserved).toFixed(Config.AMOUNT.SCALE)
          processedTransfers[transferId] = { transferState, transfer, rawMessage, transferAmount, runningPosition, runningReservedValue }
        }
        histTimerValidatePositionBatchEnd({ success: true, queryName: 'facade_prepareChangeParticipantPositionTransaction_transaction_ValidatePositionBatch' })
        const histTimerUpdateParticipantPositionEnd = Metrics.getHistogram(
          'model_position',
          'facade_prepareChangeParticipantPositionTransaction_transaction_UpdateParticipantPosition - Metrics for position model',
          ['success', 'queryName']
        ).startTimer()
        /*
          Update the participantPosition with the eventual impact of the Batch
          So the position moves forward by the sum of the transfers actually reserved (sumReserved)
          and the reserved amount is cleared of the we reserved in the first instance (sumTransfersInBatch)
        */
        const processedPositionValue = new MLNumber(initialParticipantPosition.value).add(sumReserved)
        await knex('participantPosition').transacting(trx).where({ participantPositionId: initialParticipantPosition.participantPositionId }).update({
          value: processedPositionValue.toFixed(Config.AMOUNT.SCALE),
          reservedValue: new MLNumber(initialParticipantPosition.reservedValue).subtract(sumTransfersInBatch).toFixed(Config.AMOUNT.SCALE),
          changedDate: transactionTimestamp
        })
        // TODO this limit needs to be clarified
        if (processedPositionValue.toNumber() > liquidityCover.multiply(participantLimit.thresholdAlarmPercentage).toNumber()) {
          limitAlarms.push(participantLimit)
        }
        histTimerUpdateParticipantPositionEnd({ success: true, queryName: 'facade_prepareChangeParticipantPositionTransaction_transaction_UpdateParticipantPosition' })
        /*
          Persist the transferStateChanges and associated participantPositionChange entry to record the running position
          The transferStateChanges need to be persisted first (by INSERTing) to have the PK reference
        */
        const histTimerPersistTransferStateChangeEnd = Metrics.getHistogram(
          'model_position',
          'facade_prepareChangeParticipantPositionTransaction_transaction_PersistTransferState - Metrics for position model',
          ['success', 'queryName']
        ).startTimer()
        await knex('transfer').transacting(trx).forUpdate().whereIn('transferId', transferIdList).select('*')
        const processedTransferStateChangeList = Object.keys(processedTransfers).length && Array.from(transferIdList.map(transferId => processedTransfers[transferId].transferState))
        const processedTransferStateChangeIdList = processedTransferStateChangeList && Object.keys(processedTransferStateChangeList).length && await knex.batchInsert('transferStateChange', processedTransferStateChangeList).transacting(trx)
        const processedTransfersKeysList = Object.keys(processedTransfers)
        const batchParticipantPositionChange = []
        for (const keyIndex in processedTransfersKeysList) {
          const { runningPosition, runningReservedValue } = processedTransfers[processedTransfersKeysList[keyIndex]]
          const participantPositionChange = {
            participantPositionId: initialParticipantPosition.participantPositionId,
            transferStateChangeId: processedTransferStateChangeIdList[keyIndex],
            value: runningPosition,
            // processBatch: <uuid> - a single value uuid for this entire batch to make sure the set of transfers in this batch can be clearly grouped
            reservedValue: runningReservedValue
          }
          batchParticipantPositionChange.push(participantPositionChange)
        }
        batchParticipantPositionChange.length && await knex.batchInsert('participantPositionChange', batchParticipantPositionChange).transacting(trx)
        histTimerPersistTransferStateChangeEnd({ success: true, queryName: 'facade_prepareChangeParticipantPositionTransaction_transaction_PersistTransferState' })
        await trx.commit()
        histTimerChangeParticipantPositionTransEnd({ success: true, queryName: 'facade_prepareChangeParticipantPositionTransaction_transaction' })
      } catch (err) {
        Logger.isErrorEnabled && Logger.error(err)
        await trx.rollback()
        histTimerChangeParticipantPositionTransEnd({ success: false, queryName: 'facade_prepareChangeParticipantPositionTransaction_transaction' })
        throw ErrorHandler.Factory.reformatFSPIOPError(err)
      }
    })
    const preparedMessagesList = Array.from(transferIdList.map(transferId =>
      transferId in processedTransfers
        ? reservedTransfers[transferId]
        : abortedTransfers[transferId]
    ))
    histTimerChangeParticipantPositionEnd({ success: true, queryName: 'facade_prepareChangeParticipantPositionTransaction' })
    return { preparedMessagesList, limitAlarms }
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    histTimerChangeParticipantPositionEnd({ success: false, queryName: 'facade_prepareChangeParticipantPositionTransaction' })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const changeParticipantPositionTransaction = async (participantCurrencyId, isReversal, amount, transferStateChange) => {
  const histTimerChangeParticipantPositionTransactionEnd = Metrics.getHistogram(
    'model_position',
    'facade_changeParticipantPositionTransaction - Metrics for position model',
    ['success', 'queryName']
  ).startTimer()
  try {
    const knex = await Db.getKnex()
    await knex.transaction(async (trx) => {
      try {
        const transactionTimestamp = Time.getUTCString(new Date())
        transferStateChange.createdDate = transactionTimestamp
        const participantPosition = await knex('participantPosition').transacting(trx).where({ participantCurrencyId }).forUpdate().select('*').first()
        let latestPosition
        if (isReversal) {
          latestPosition = new MLNumber(participantPosition.value).subtract(amount)
        } else {
          latestPosition = new MLNumber(participantPosition.value).add(amount)
        }
        latestPosition = latestPosition.toFixed(Config.AMOUNT.SCALE)
        await knex('participantPosition').transacting(trx).where({ participantCurrencyId }).update({
          value: latestPosition,
          changedDate: transactionTimestamp
        })
        await knex('transferStateChange').transacting(trx).insert(transferStateChange)
        const insertedTransferStateChange = await knex('transferStateChange').transacting(trx).where({ transferId: transferStateChange.transferId }).forUpdate().first().orderBy('transferStateChangeId', 'desc')
        const participantPositionChange = {
          participantPositionId: participantPosition.participantPositionId,
          transferStateChangeId: insertedTransferStateChange.transferStateChangeId,
          value: latestPosition,
          reservedValue: participantPosition.reservedValue,
          createdDate: transactionTimestamp
        }
        await knex('participantPositionChange').transacting(trx).insert(participantPositionChange)
        await trx.commit()
        histTimerChangeParticipantPositionTransactionEnd({ success: true, queryName: 'facade_changeParticipantPositionTransaction' })
      } catch (err) {
        await trx.rollback()
        throw ErrorHandler.Factory.reformatFSPIOPError(err)
      }
    }).catch((err) => {
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    })
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/**
 * @function GetByNameAndCurrency
 *
 * @async
 * @description This returns the active position of a participant and currency combination, if currency is not passed then all the active currencies are considered
 *
 *
 * @param {string} name - the name of the participant. Example 'dfsp1'
 * @param {integer} ledgerAccountTypeId - ledger account type. Example: 1
 * @param [currencyId = null] - optional currency parameter
 *
 * @returns {array} - Returns an array containing the details of active position(s) for the participant if successful, or throws an error if failed
 */

const getByNameAndCurrency = async (name, ledgerAccountTypeId, currencyId = null) => {
  try {
    return Db.from('participantPosition').query(builder => {
      return builder.innerJoin('participantCurrency AS pc', 'participantPosition.participantCurrencyId', 'pc.participantCurrencyId')
        .innerJoin('participant AS p', 'pc.participantId', 'p.participantId')
        .where({
          'p.name': name,
          'p.isActive': 1,
          'pc.isActive': 1,
          'pc.ledgerAccountTypeId': ledgerAccountTypeId
        })
        .where(q => {
          if (currencyId !== null) {
            return q.where('pc.currencyId', currencyId)
          }
        })
        .select('participantPosition.*',
          'pc.currencyId')
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const getAllByNameAndCurrency = async (name, currencyId = null) => {
  try {
    return Db.from('participantPosition').query(builder => {
      return builder.innerJoin('participantCurrency AS pc', 'participantPosition.participantCurrencyId', 'pc.participantCurrencyId')
        .innerJoin('ledgerAccountType AS lap', 'lap.ledgerAccountTypeId', 'pc.ledgerAccountTypeId')
        .innerJoin('participant AS p', 'pc.participantId', 'p.participantId')
        .where({
          'p.name': name
        })
        .where(q => {
          if (currencyId !== null) {
            return q.where('pc.currencyId', currencyId)
          }
        })
        .select('participantPosition.*',
          'lap.name AS ledgerAccountType',
          'pc.currencyId',
          'pc.isActive'
        )
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  changeParticipantPositionTransaction,
  prepareChangeParticipantPositionTransaction,
  getByNameAndCurrency,
  getAllByNameAndCurrency
}
