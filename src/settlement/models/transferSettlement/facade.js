/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
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

 * ModusBox
 - Deon Botha <deon.botha@modusbox.com>
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Valentin Genev <valentin.genev@modusbox.com>
 - Claudio Viola <claudio.viola@modusbox.com>
 --------------
 ******/

'use strict'

const Db = require('../../lib/db')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { logger } = require('../../shared/logger')
const Utility = require('@mojaloop/central-services-shared').Util
const location = { module: 'TransferFulfilHandler', method: '', path: '' }
const SettlementEnum = require('@mojaloop/central-services-shared').Enum.Settlements
const TransferStateEnum = require('@mojaloop/central-services-shared').Enum.Transfers.TransferState
const TransferFacade = require('../../../models/transfer/facade')

async function insertLedgerEntry (ledgerEntry, transferId, trx = null) {
  try {
    const knex = await Db.getKnex()
    const trxFunction = async (trx) => {
      try {
        const recordsToInsert = await knex.select(knex.raw('? AS transferId', transferId), 'PC.participantCurrencyId')
          .select(knex.raw('IFNULL (??, ??) as ??', ['T1.transferparticipantroletypeId', 'T2.transferparticipantroletypeId', 'transferParticipantRoleTypeId']))
          .select('E.ledgerEntryTypeId')
          .select(knex.raw('CASE ?? WHEN ? THEN ? WHEN ? THEN ? ELSE ? END AS ??', ['P.name', ledgerEntry.payerFspId, ledgerEntry.amount, ledgerEntry.payeeFspId, ledgerEntry.amount * -1, 0, 'amount']))
          .select('PC.participantId')
          .from('participantCurrency as PC')
          .innerJoin('participant as P', 'P.participantId', 'PC.participantId')
          .innerJoin('ledgerEntryType as E', 'E.LedgerAccountTypeId', 'PC.LedgerAccountTypeId')
          .leftOuterJoin('transferParticipantRoleType as T1', function () { this.on('P.name', '=', knex.raw('?', [ledgerEntry.payerFspId])).andOn('T1.name', knex.raw('?', ['PAYER_DFSP'])) })
          .leftOuterJoin('transferParticipantRoleType as T2', function () { this.on('P.name', '=', knex.raw('?', [ledgerEntry.payeeFspId])).andOn('T2.name', knex.raw('?', ['PAYEE_DFSP'])) })
          .where('E.name', ledgerEntry.ledgerEntryTypeId)
          .whereIn('P.name', [ledgerEntry.payerFspId, ledgerEntry.payeeFspId])
          .where('PC.currencyId', ledgerEntry.currency)
          .transacting(trx)

        if (!Array.isArray(recordsToInsert) || recordsToInsert.length === 0) {
          const error = new Error(`No settlement model defined for transferId: ${transferId} and ledgerEntry: ${JSON.stringify(ledgerEntry)}`)
          logger.error(error)
          throw error
        }

        await knex('transferParticipant')
          .insert(recordsToInsert)
          .transacting(trx)

        await Promise.all(recordsToInsert.map(async record => {
          const queryResult = await knex('participantPosition')
            .where('participantCurrencyId', '=', record.participantCurrencyId)
            .increment('value', record.amount)
            .transacting(trx)
          if (queryResult === 0) {
            const error = ErrorHandler.Factory.createInternalServerFSPIOPError(`Unable to update participantPosition record for participantCurrencyId: ${record.participantCurrencyId}`)
            logger.error(error)
            throw error
          }
        }))

        const transferStateChangeId = await knex('transferStateChange')
          .select('transferStateChangeId')
          .where('transferId', transferId)
          .andWhere('transferStateId', TransferStateEnum.COMMITTED)
          .transacting(trx)
        if (transferStateChangeId.length === 0 || !transferStateChangeId[0].transferStateChangeId || transferStateChangeId.length > 1) {
          const error = ErrorHandler.Factory.createInternalServerFSPIOPError(`Unable to find transfer with COMMITTED state for transferId : ${transferId}`)
          logger.error(error)
          throw error
        }

        const participantPositionRecords = await knex('participantPosition')
          .select('participantPositionId', 'participantCurrencyId', 'value', 'reservedValue',
            knex.raw(`
              CASE
                WHEN participantCurrencyId = ? THEN ?
                WHEN participantCurrencyId = ? THEN ?
              END AS \`change\`
            `, [
              recordsToInsert[0].participantCurrencyId, recordsToInsert[0].amount,
              recordsToInsert[1].participantCurrencyId, recordsToInsert[1].amount
            ]))
          .where('participantCurrencyId', recordsToInsert[0].participantCurrencyId)
          .orWhere('participantCurrencyId', recordsToInsert[1].participantCurrencyId)
          .transacting(trx)

        if (participantPositionRecords.length !== 2) {
          const error = ErrorHandler.Factory.createInternalServerFSPIOPError(`Unable to find all participantPosition records for ParticipantCurrency: {${recordsToInsert[0].participantCurrencyId},${recordsToInsert[1].participantCurrencyId}}`)
          logger.error(error)
          throw error
        }
        const participantPositionChangeRecords = participantPositionRecords.map(participantPositionRecord => {
          participantPositionRecord.transferStateChangeId = transferStateChangeId[0].transferStateChangeId
          return participantPositionRecord
        })

        await knex('participantPositionChange')
          .insert(participantPositionChangeRecords)
          .transacting(trx)
      } catch (err) {
        logger.error(err)
        throw err
      }
    }
    if (trx) {
      return await trxFunction(trx)
    } else {
      return await knex.transaction(trxFunction)
    }
  } catch (err) {
    logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

async function insertLedgerEntries (ledgerEntries, transferId, trx = null) {
  logger.info(`Ledger entries: ${JSON.stringify(ledgerEntries)}`)
  try {
    const knex = await Db.getKnex()
    const trxFunction = async (trx) => {
      try {
        for (const ledgerEntry of ledgerEntries) {
          logger.info(`Inserting ledger entry: ${JSON.stringify(ledgerEntry)}`)
          await insertLedgerEntry(ledgerEntry, transferId, trx)
        }
      } catch (err) {
        logger.error(err)
        throw err
      }
    }
    if (trx) {
      return await trxFunction(trx)
    } else {
      return await knex.transaction(trxFunction)
    }
  } catch (err) {
    logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

async function updateTransferSettlement (transferId, status, trx = null) {
  logger.info(Utility.breadcrumb(location, { method: 'updateTransferSettlement' }))
  try {
    const knex = await Db.getKnex()
    const trxFunction = async (trx) => {
      const transactionTimestamp = new Date()

      // Insert TransferParticipant ledger entry type.
      await knex.from(knex.raw('transferParticipant (transferID, participantCurrencyId, transferParticipantRoleTypeId, ledgerEntryTypeId, participantId, amount)'))
        // insert debit/credit ledger entries for matching ledger entries for both Settlement and Position accounts
        .insert(function () {
          this.from('transferParticipant AS TP')
            // Select ledger entries for POSITION accounts that match the Settlement Model based on the Granularity type with REVERSED amounts
            .select('TP.transferId', 'TP.participantCurrencyId', 'TP.transferParticipantRoleTypeId', 'TP.ledgerEntryTypeId', 'TP.participantId', knex.raw('?? * -1', ['TP.amount']))
            .innerJoin('participantCurrency AS PC', 'TP.participantCurrencyId', 'PC.participantCurrencyId')
            .innerJoin('settlementModel AS M', 'PC.ledgerAccountTypeId', 'M.ledgerAccountTypeId')
            .innerJoin('settlementGranularity AS G', 'M.settlementGranularityId', 'G.settlementGranularityId')
            .where(function () {
              this.where({ 'TP.transferId': transferId })
              this.andWhere(function () {
                this.andWhere({ 'G.name': SettlementEnum.settlementGranularityName.GROSS })
              })
            })
            .union(function () {
              // Select ledger entries for SETTLEMENT accounts that match the Settlement Model based on the Granularity type with NORMAL amounts
              this.select('TP.transferId', 'PC1.participantCurrencyId', 'TP.transferParticipantRoleTypeId', 'TP.ledgerEntryTypeId', 'TP.participantId', 'TP.amount')
                .from('transferParticipant AS TP')
                .innerJoin('participantCurrency AS PC', 'TP.participantCurrencyId', 'PC.participantCurrencyId')
                .innerJoin('settlementModel AS M', 'PC.ledgerAccountTypeId', 'M.ledgerAccountTypeId')
                .innerJoin('settlementGranularity AS G', 'M.settlementGranularityId', 'G.settlementGranularityId')
                .innerJoin('participantCurrency AS PC1', function () {
                  this.on('PC1.currencyId', 'PC.currencyId')
                    .andOn('PC1.participantId', 'PC.participantId')
                    .andOn('PC1.ledgerAccountTypeId', 'M.settlementAccountTypeId')
                })
                .where(function () {
                  this.where({ 'TP.transferId': transferId })
                  this.andWhere(function () {
                    this.andWhere({ 'G.name': SettlementEnum.settlementGranularityName.GROSS })
                  })
                })
            })
        })
        .transacting(trx)

      // Insert a new status for the transfer.
      const transferStateChange = [
        {
          transferId,
          transferStateId: TransferStateEnum.SETTLED,
          reason: 'Gross settlement process'
        }
      ]

      await knex('transferStateChange').insert(transferStateChange)
        .transacting(trx)

      // Update the positions
      await knex('participantPosition AS PP')
        .update({ value: knex.raw('?? - ??', ['PP.value', 'TR.amount']), changedDate: transactionTimestamp })
        .innerJoin(function () {
          this.from('transferParticipant AS TP')
          // Select ledger entries for POSITION accounts that match the Settlement Model based on the Granularity type with NORMAL amounts
            .select('PC.participantCurrencyId', 'TP.Amount')
            .innerJoin('participantCurrency AS PC', 'TP.participantCurrencyId', 'PC.participantCurrencyId')
            .innerJoin('settlementModel AS M', 'M.ledgerAccountTypeId', 'PC.ledgerAccountTypeId')
            .innerJoin('settlementGranularity AS G', 'M.settlementGranularityId', 'G.settlementGranularityId')
            .where(function () {
              this.where({ 'TP.transferId': transferId })
              this.andWhere(function () {
                this.andWhere({ 'G.name': SettlementEnum.settlementGranularityName.GROSS })
              })
            })
            .union(function () {
              // Select ledger entries for SETTLEMENT accounts that match the Settlement Model based on the Granularity type with REVERSED amounts
              this.select('PC1.participantCurrencyId', knex.raw('?? * -1', ['TP.amount']))
                .from('transferParticipant AS TP')
                .innerJoin('participantCurrency AS PC', 'TP.participantCurrencyId', 'PC.participantCurrencyId')
                .innerJoin('settlementModel AS M', 'M.ledgerAccountTypeId', 'PC.ledgerAccountTypeId')
                .innerJoin('settlementGranularity AS G', 'M.settlementGranularityId', 'G.settlementGranularityId')
                .innerJoin('participantCurrency AS PC1', function () {
                  this.on('PC1.currencyId', 'PC.currencyId')
                    .andOn('PC1.participantId', 'PC.participantId')
                    .andOn('PC1.ledgerAccountTypeId', 'M.settlementAccountTypeId')
                })
                .where(function () {
                  this.where({ 'TP.transferId': transferId })
                  this.andWhere(function () {
                    this.andWhere({ 'G.name': SettlementEnum.settlementGranularityName.GROSS })
                  })
                })
            })
        }).joinRaw('AS TR ON PP.participantCurrencyId = TR.ParticipantCurrencyId')
        .transacting(trx)

      // Insert new participant position change records
      await knex.from(knex.raw('participantPositionChange (participantPositionId, transferStateChangeId, value, `change`, reservedValue, participantCurrencyId)'))
        .insert(function () {
          this.from('participantPosition AS PP')
            .select('PP.participantPositionId', 'TSC.transferStateChangeId', 'PP.value', 'PP.reservedValue', 'TR.amount', 'PP.participantCurrencyId')
            .innerJoin(function () {
              this.from('transferParticipant AS TP')
                .select('PC.participantCurrencyId', 'TP.amount')
                .innerJoin('participantCurrency AS PC', 'TP.participantCurrencyId', 'PC.participantCurrencyId')
                .innerJoin('settlementModel AS M', 'M.ledgerAccountTypeId', 'PC.ledgerAccountTypeId')
                .innerJoin('settlementGranularity AS G', 'M.settlementGranularityId', 'G.settlementGranularityId')
                .where(function () {
                  this.where({ 'TP.transferId': transferId })
                  this.andWhere(function () {
                    this.andWhere({ 'G.name': SettlementEnum.settlementGranularityName.GROSS })
                  })
                })
                .union(function () {
                  this.select('PC1.participantCurrencyId', 'TP.amount')
                    .from('transferParticipant AS TP')
                    .innerJoin('participantCurrency AS PC', 'TP.participantCurrencyId', 'PC.participantCurrencyId')
                    .innerJoin('settlementModel AS M', 'M.ledgerAccountTypeId', 'PC.ledgerAccountTypeId')
                    .innerJoin('settlementGranularity AS G', 'M.settlementGranularityId', 'G.settlementGranularityId')
                    .innerJoin('participantCurrency AS PC1', function () {
                      this.on('PC1.currencyId', 'PC.currencyId')
                        .andOn('PC1.participantId', 'PC.participantId')
                        .andOn('PC1.ledgerAccountTypeId', 'M.settlementAccountTypeId')
                    })
                    .where(function () {
                      this.where({ 'TP.transferId': transferId })
                      this.andWhere(function () {
                        this.andWhere({ 'G.name': SettlementEnum.settlementGranularityName.GROSS })
                      })
                    })
                })
            })
          this.joinRaw('AS TR ON PP.participantCurrencyId = TR.ParticipantCurrencyId')
            .innerJoin('transferStateChange AS TSC', function () {
              this.on('TSC.transferID', knex.raw('?', [transferId]))
                .andOn('TSC.transferStateId', '=', knex.raw('?', [TransferStateEnum.SETTLED]))
            })
        })
        .transacting(trx)
    }
    if (trx) {
      return await trxFunction(trx)
    } else {
      return await knex.transaction(trxFunction)
    }
  } catch (err) {
    logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

async function getSettlementModelByTransferId (transferId, settlementGranularityName) {
  logger.info(Utility.breadcrumb(location, { method: 'getSettlementModelByTransferId' }))
  const knex = await Db.getKnex()
  const settlementModelByTransferId = await knex('settlementModel')
    .join('participantCurrency AS pc', function () {
      this.on('pc.currencyId', 'settlementModel.currencyId')
        .andOn('pc.ledgerAccountTypeId', 'settlementModel.ledgerAccountTypeId')
    })
    .join('transferParticipant AS tp', 'tp.participantCurrencyId', 'pc.participantCurrencyId')
    .join('settlementGranularity AS g', 'g.settlementGranularityId', 'settlementModel.settlementGranularityId')
    .where('tp.transferId', transferId)
    .where('g.name', settlementGranularityName)
    .where('settlementModel.isActive', 1)
    .select('settlementModel.*')
  if (settlementModelByTransferId.length === 0) {
    const allSettlementModels = await Db.from('settlementModel').find()
    const transferCurrency = (await TransferFacade.getByIdLight(transferId)).currencyId
    switch (settlementGranularityName) {
      case SettlementEnum.settlementGranularityName.GROSS: {
        const netModelWithCurrency = allSettlementModels.filter(sm => (sm.currencyId === transferCurrency && sm.settlementGranularityId === SettlementEnum.SettlementGranularity.NET))
        if (netModelWithCurrency.length === 0) {
          const defaultGrossSettlementModel = allSettlementModels.filter(sm => (sm.currencyId === null && sm.settlementGranularityId === SettlementEnum.SettlementGranularity.GROSS))
          return defaultGrossSettlementModel
        }
        break
      }
      case SettlementEnum.settlementGranularityName.NET: {
        const grossModelWithCurrency = allSettlementModels.filter(sm => (sm.currencyId === transferCurrency && sm.settlementGranularityId === SettlementEnum.SettlementGranularity.GROSS))
        if (grossModelWithCurrency.length === 0) {
          const defaultNetSettlementModel = allSettlementModels.filter(sm => (sm.currencyId === null && sm.settlementGranularityId === SettlementEnum.SettlementGranularity.NET))
          return defaultNetSettlementModel
        }
        break
      }
    }
  }
  return settlementModelByTransferId
}

const Facade = {
  insertLedgerEntry,
  insertLedgerEntries,
  updateTransferSettlement,
  getSettlementModelByTransferId
}

module.exports = Facade
