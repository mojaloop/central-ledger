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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 * James Bush <james.bush@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * @module src/domain/transfer/
 */

const util = require('util');

const Time = require('@mojaloop/central-services-shared').Util.Time

const TransferFacade = require('../../models/transfer/facade')
const ParticipantFacade = require('../../models/participant/facade')
const TransferModel = require('../../models/transfer/transfer')
const TransferStateChangeModel = require('../../models/transfer/transferStateChange')
const TransferErrorModel = require('../../models/transfer/transferError')
const TransferDuplicateCheckModel = require('../../models/transfer/transferDuplicateCheck')
const TransferFulfilmentDuplicateCheckModel = require('../../models/transfer/transferFulfilmentDuplicateCheck')
const TransferErrorDuplicateCheckModel = require('../../models/transfer/transferErrorDuplicateCheck')
const TransferObjectTransform = require('./transform')
const TransferError = require('../../models/transfer/transferError')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Metrics = require('@mojaloop/central-services-metrics')

const Logger = require('@mojaloop/central-services-logger')

//YUCK!!! TODO: get rid of lodash ASAP!
const _ = require('lodash')


const prepare = async (payload, stateReason = null, hasPassedValidation = true) => {
  const histTimerTransferServicePrepareEnd = Metrics.getHistogram(
    'domain_transfer',
    'prepare - Metrics for transfer domain',
    ['success', 'funcName']
  ).startTimer()
  try {
    const result = await TransferFacade.saveTransferPrepared(payload, stateReason, hasPassedValidation)
    histTimerTransferServicePrepareEnd({ success: true, funcName: 'prepare' })
    return result
  } catch (err) {
    histTimerTransferServicePrepareEnd({ success: false, funcName: 'prepare' })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const handlePayeeResponse = async (transferId, payload, action, fspiopError) => {
  const histTimerTransferServiceHandlePayeeResponseEnd = Metrics.getHistogram(
    'domain_transfer',
    'prepare - Metrics for transfer domain',
    ['success', 'funcName']
  ).startTimer()

  try {
    const transfer = await TransferFacade.savePayeeTransferResponse(transferId, payload, action, fspiopError)
    const result = TransferObjectTransform.toTransfer(transfer)
    histTimerTransferServiceHandlePayeeResponseEnd({ success: true, funcName: 'handlePayeeResponse' })
    return result
  } catch (err) {
    histTimerTransferServiceHandlePayeeResponseEnd({ success: false, funcName: 'handlePayeeResponse' })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/**
 * @function LogTransferError
 *
 * @async
 * @description This will insert a record into the transferError table for the latest transfer stage change id.
 *
 * TransferStateChangeModel.getByTransferId called to get the latest transfer state change id
 * TransferError.insert called to insert the record into the transferError table
 *
 * @param {string} transferId - the transfer id
 * @param {integer} errorCode - the error code
 * @param {string} errorDescription - the description error
 *
 * @returns {integer} - Returns the id of the transferError record if successful, or throws an error if failed
 */

const logTransferError = async (transferId, errorCode, errorDescription) => {
  try {
    const transferStateChange = await TransferStateChangeModel.getByTransferId(transferId)
    return TransferError.insert(transferId, transferStateChange.transferStateChangeId, errorCode, errorDescription)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}


/**
 * Combined prepare and payer position adjustment
 */
const preparePosition = async (payload, stateReason = null, hasPassedValidation = true) => {
  const histTimerTransferServicePrepareEnd = Metrics.getHistogram(
    'domain_transfer',
    'preparePosition - Metrics for transfer domain',
    ['success', 'funcName']
  ).startTimer()
  try {
    const result = await saveTransferPreparedChangePosition(payload, stateReason, hasPassedValidation)

    histTimerTransferServicePrepareEnd({ success: true, funcName: 'preparePosition' })
    return result
  } catch (err) {
    histTimerTransferServicePrepareEnd({ success: false, funcName: 'preparePosition' })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }

}


/**
 * Do lots of things inline right now for speed. possibly push back into facade/model later although
 * I tend to think that the existing "deep" dependency tree needs flattening somewhat.
 */


const Db = require('../../lib/db')
const Enum = require('@mojaloop/central-services-shared').Enum
const TransferEventAction = Enum.Events.Event.Action
const TransferInternalState = Enum.Transfers.TransferInternalState
const NodeCache = require('node-cache')



//some quick and dirty in-memory cache stuff

const cacheOptions = {
  stdTTL: 120, //seconds
  checkPeriod: 60 //seconds
}

const participantCache = new NodeCache(cacheOptions);


const cachedParticipantGetByNameAndCurrency = async(name, currency, acctType) => {
  const cacheKey = `part_${name}-${currency}-${acctType}`
  let val = participantCache.get(cacheKey)

  if(!val) {
    Logger.info('cache miss looking up participant currency id')
    val = await ParticipantFacade.getByNameAndCurrency(name, currency, acctType)
    participantCache.set(cacheKey, val)
  }

  return val
}


const cachedGetParticipantPositionId = async (participantCurrencyId) => {
  const cacheKey = `posid_${participantCurrencyId}`
  let val = participantCache.get(cacheKey)

  if(!val) {
    const knex = await Db.getKnex()
    Logger.info('Cache miss looking up position id for participant currency')
    val = await knex.raw(`SELECT participantPositionId FROM participantPosition `
      + `WHERE participantCurrencyId = ${participantCurrencyId}`);

    if(val[0].length !== 1) {
      //should be 1 row here and only 1
      throw new Error(`Expecting 1 row looking for participantPositionId for participantCurrencyId=${participantCurrencyId} but got ${val[0].length}`);
    }

    val = val[0][0].participantPositionId;
    Logger.info(`Caching participantPositionId ${util.inspect(val)} for participantCurrencyId ${participantCurrencyId}`);
    participantCache.set(cacheKey, val);
  }

  return val;
}


const cachedGetParticipantNDCLimitId = async (participantCurrencyId) => {
  const cacheKey = `limit_${participantCurrencyId}`
  let val = participantCache.get(cacheKey)

  if(!val) {
    Logger.info('Cache miss looking up NDC limit id for participant currency')
    const knex = await Db.getKnex()
    val = await knex.raw(`SELECT participantLimitId FROM participantLimit `
      + `WHERE participantCurrencyId = ${participantCurrencyId} `
      + `AND participantLimitTypeId = ${Enum.Accounts.ParticipantLimitType.NET_DEBIT_CAP}`)

    if(val[0].length !== 1) {
      //should be 1 row here and only 1
      throw new Error(`Expecting 1 row looking for participantLimitId for participantCurrencyId=${participantCurrencyId} but got ${val[0].length}`);
    }

    val = val[0][0].participantLimitId;
    Logger.info(`Caching participantNDCLimitId ${util.inspect(val)} for participantCurrencyId ${participantCurrencyId}`);
    participantCache.set(cacheKey, val);
  }

  return val;  
}



/**
 * This function implements the DB interaction logic for writing the transfer to the DB and adjusting payer dfsp position
 */
const saveTransferPreparedChangePosition = async (payload, stateReason = null, hasPassedValidation = true) => {
  const histTimerSaveTransferPreparedEnd = Metrics.getHistogram(
    'model_transfer',
    'facade_saveTransferPreparedChangePosition - Metrics for transfer model',
    ['success', 'queryName']
  ).startTimer()

  const knex = await Db.getKnex()

  const now = new Date()

  try {
    const participants = []
    const names = [payload.payeeFsp, payload.payerFsp]

    for (const name of names) {
      const participant = await cachedParticipantGetByNameAndCurrency(name, payload.amount.currency, Enum.Accounts.LedgerAccountType.POSITION)
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
      createdDate: Time.getUTCString(now)
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

      let transferStateChangeId;

      //first transaction - this is to "save" the transfer details. This should happend and persist even on further errors
      await knex.transaction(async (trx) => {
        try {
          let transferExtensionsRecordList = []

          if (payload.extensionList && payload.extensionList.extension) {
            transferExtensionsRecordList = payload.extensionList.extension.map(ext => {
              return {
                transferId: payload.transferId,
                key: ext.key,
                value: ext.value
              }
            })
          }

          //attempt to run all inserts async; this has been observed to have little effect on performance
          //as all statements in a single transaction execute on the same connection. No parallel speed up
          //is really possible as there is no posibility for I/O parallelism.
          //Regardless, leave this in place as it *should* not have any detremental effects
          await Promise.all([knex('transfer').transacting(trx).insert(transferRecord),
            knex('transferParticipant').transacting(trx).insert(payerTransferParticipantRecord),
            knex('transferParticipant').transacting(trx).insert(payeeTransferParticipantRecord),
            knex('ilpPacket').transacting(trx).insert(ilpPacketRecord),
            knex.batchInsert('transferExtension', transferExtensionsRecordList).transacting(trx)])

          //we need the tsc ID for the position change later so get it during the insert
          transferStateChangeId = await knex('transferStateChange')
            .transacting(trx).insert(transferStateChangeRecord).returning('transferStateChangeId')

          await trx.commit()
          histTimerSaveTranferTransactionValidationPassedEnd({ success: true, queryName: 'facade_saveTransferPrepared_transaction' })
        } catch (err) {
          await trx.rollback(err)
          histTimerSaveTranferTransactionValidationPassedEnd({ success: false, queryName: 'facade_saveTransferPrepared_transaction' })
          throw err
        }
      })

      //second transaction - this to try to adjust the payer dfsp position. this should fail if NDC is exceeded
      //note that we are effectively inlining PositionFacade.changeParticipantPositionTransaction(participantCurrencyId,
      //isReversal, amount, transferStateChange) in order to look for optimisations across the sql

      //no transaction necessary, single statement only

      const participantPositionId = await cachedGetParticipantPositionId(participantCurrencyIds[payload.payerFsp])
      const participantLimitId = await cachedGetParticipantNDCLimitId(participantCurrencyIds[payload.payerFsp])

      const positionSql = `UPDATE participantPosition SET value = (value + ${payload.amount.amount}) `
        + `WHERE participantPositionId = ${participantPositionId} `
        + `AND (value + ${payload.amount.amount}) < (SELECT value FROM participantLimit WHERE participantLimitId = ${participantLimitId})`;

      const positionChangeSql = `INSERT INTO participantPositionChange `
        + `(participantPositionId, transferStateChangeId, value, reservedValue, createdDate) `
        + `SELECT ${participantPositionId}, ${transferStateChangeId}, value, reservedValue, '${Time.getUTCString(now)}' `
        + `FROM participantPosition WHERE participantPositionId = ${participantPositionId}`

      await knex.transaction(async (trx) => {
        try {
          //try to increment the position of the payer dfsp. This is done in a single statement that will either
          //alter 1 row on success or 0 rows if the NDC limit is exceeded by the update
          const positionUpdateResult = await trx.raw(positionSql);

          Logger.info(`Position update result for transfer ${payload.transferId}: ${util.inspect(positionUpdateResult, { depth: Infinity })})`);

          if(positionUpdateResult[0].affectedRows !== 1) {
            //this is an NDC limit breach
            Logger.error(`Position update failed for transfer ${payload.transferId} assuming NDC breach`)
            //we would spit out a position breach notification event here but
            //as this is just a performance proof of concept, dont bother.
            const e = new Error('Payer DFSP NDC breach')
            await trx.rollback(e)
            throw e
          }

          const positionChangeInsertResult = await trx.raw(positionChangeSql);

          //now, in the same transaction (assuming READ COMMITTED isolation!) we insert a new row in
          //participantPositionChange to record the update
          if(positionChangeInsertResult[0].affectedRows !== 1) {
            //we should have exactly one row here!
            Logger.error(`Updated position read failed for transfer ${payload.transferId}. rolling back.`)
            //we would spit out an internal error notification event here but
            //as this is just a performance proof of concept, dont bother.
            const e = new Error('Position change insert did not affect 1 row')
            await trx.rollback(e)
            throw e
          }

          //all good, commit the db transaction
          await trx.commit()
          histTimerSaveTranferTransactionValidationPassedEnd({ success: true, queryName: 'facade_saveTransferPrepared_transaction' })
        } catch (err) {
          //TODO: handle this error gracefully, update transfer state to errored, send error callback etc...
          await trx.rollback(err)
          histTimerSaveTranferTransactionValidationPassedEnd({ success: false, queryName: 'facade_saveTransferPrepared_transaction' })
          Logger.error(`Error executing position update query for transfer ${payload.transferId}: ${err.stack || util.inspect(err)}`)
          throw err
        }
      })

      //all good if we get here, return the results of our two db transactions
      return true;
    } else {
      throw new Error('combined prepare-position handler not handling validation failure cases') 
    }
    histTimerSaveTransferPreparedEnd({ success: true, queryName: 'transfer_model_facade_saveTransferPrepared' })
  } catch (err) {
    histTimerSaveTransferPreparedEnd({ success: false, queryName: 'transfer_model_facade_saveTransferPrepared' })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}




const TransferService = {
  prepare,
  preparePosition,
  handlePayeeResponse,
  logTransferError,
  getTransferErrorByTransferId: TransferErrorModel.getByTransferId,
  getTransferById: TransferModel.getById,
  getById: TransferFacade.getById,
  getByIdLight: TransferFacade.getByIdLight,
  getAll: TransferFacade.getAll,
  getTransferState: TransferStateChangeModel.getByTransferId,
  getTransferInfoToChangePosition: TransferFacade.getTransferInfoToChangePosition,
  saveTransferStateChange: TransferStateChangeModel.saveTransferStateChange,
  getTransferStateChange: TransferFacade.getTransferStateByTransferId,
  reconciliationTransferPrepare: TransferFacade.reconciliationTransferPrepare,
  reconciliationTransferReserve: TransferFacade.reconciliationTransferReserve,
  reconciliationTransferCommit: TransferFacade.reconciliationTransferCommit,
  reconciliationTransferAbort: TransferFacade.reconciliationTransferAbort,
  getTransferParticipant: TransferFacade.getTransferParticipant,
  getTransferDuplicateCheck: TransferDuplicateCheckModel.getTransferDuplicateCheck,
  saveTransferDuplicateCheck: TransferDuplicateCheckModel.saveTransferDuplicateCheck,
  getTransferFulfilmentDuplicateCheck: TransferFulfilmentDuplicateCheckModel.getTransferFulfilmentDuplicateCheck,
  saveTransferFulfilmentDuplicateCheck: TransferFulfilmentDuplicateCheckModel.saveTransferFulfilmentDuplicateCheck,
  getTransferErrorDuplicateCheck: TransferErrorDuplicateCheckModel.getTransferErrorDuplicateCheck,
  saveTransferErrorDuplicateCheck: TransferErrorDuplicateCheckModel.saveTransferErrorDuplicateCheck
}

module.exports = TransferService
