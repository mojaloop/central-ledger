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
 - Shashikant Hirugade <shashi.mojaloop@gmail.com>

 * ModusBox
 - Deon Botha <deon.botha@modusbox.com>
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Valentin Genev <valentin.genev@modusbox.com>
 --------------
 ******/
'use strict'

const Db = require('../../lib/db')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Enum = require('@mojaloop/central-services-shared').Enum
const { logger } = require('../../shared/logger')
const SettlementModelModel = require('../settlement/settlementModel')

const Facade = {
  getById: async function ({ settlementWindowId }) {
    return Db.from('settlementWindow').query(builder => {
      return builder
        .leftJoin('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId')
        .select(
          'settlementWindow.settlementWindowId',
          'swsc.settlementWindowStateId as state',
          'swsc.reason as reason',
          'settlementWindow.createdDate as createdDate',
          'swsc.createdDate as changedDate'
        )
        .first()
        .where('settlementWindow.settlementWindowId', settlementWindowId)
    })
  },

  getTransfersCount: async function ({ settlementWindowId }) {
    return Db.from('transferFulfilment').query(builder => {
      return builder
        .count('* as cnt')
        .first()
        .where('transferFulfilment.settlementWindowId', settlementWindowId)
    })
  },

  getByListOfIds: async function (listOfIds, settlementModel, winStateEnum) {
    const knex = await Db.getKnex()
    return Db.from('settlementWindow').query(builder => {
      const b = builder
        .join('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId')
        .join('settlementWindowContent AS swc', 'swc.settlementWindowId', 'settlementWindow.settlementWindowId')
        .join('settlementWindowContentStateChange AS swcsc', 'swcsc.settlementWindowContentStateChangeId', 'swc.currentStateChangeId')
        .whereRaw(`settlementWindow.settlementWindowId IN (${listOfIds})`)
        .where('swc.ledgerAccountTypeId', settlementModel.ledgerAccountTypeId)
        .where('swc.currencyId', knex.raw('COALESCE(?, swc.currencyId)', settlementModel.currencyId))
        .whereIn('swsc.settlementWindowStateId', [winStateEnum.CLOSED, winStateEnum.ABORTED, winStateEnum.PENDING_SETTLEMENT])
        .whereIn('swcsc.settlementWindowStateId', [winStateEnum.CLOSED, winStateEnum.ABORTED])
        .distinct(
          'settlementWindow.settlementWindowId',
          'swsc.settlementWindowStateId as state'
        )
      return b
    })
  },

  getByParams: async function ({ query }) {
    const { participantId, state, fromDateTime, toDateTime, currency } = query
    return Db.from('settlementWindow').query(builder => {
      if (!participantId) {
        const b = builder
          .leftJoin('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId')
          .leftJoin('transferFulfilment AS tf', 'tf.settlementWindowId', 'settlementWindow.settlementWindowId')
          .leftJoin('transferParticipant AS tp', 'tp.transferId', 'tf.transferId')
          .leftJoin('participantCurrency AS pc', 'pc.participantCurrencyId', 'tp.participantCurrencyId')
          .select(
            'settlementWindow.settlementWindowId',
            'swsc.settlementWindowStateId as state',
            'swsc.reason as reason',
            'settlementWindow.createdDate as createdDate',
            'swsc.createdDate as changedDate'
          )
          .orderBy('changedDate', 'desc').distinct()
        if (state) { b.where('swsc.settlementWindowStateId', state) }
        if (fromDateTime) { b.where('settlementWindow.createdDate', '>=', fromDateTime) }
        if (toDateTime) { b.where('settlementWindow.createdDate', '<=', toDateTime) }
        if (currency) { b.where('pc.currencyId', currency) }
        return b
      } else {
        const b = builder
          .leftJoin('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId')
          .leftJoin('transferFulfilment AS tf', 'tf.settlementWindowId', 'settlementWindow.settlementWindowId')
          .leftJoin('transferParticipant AS tp', 'tp.transferId', 'tf.transferId')
          .leftJoin('participantCurrency AS pc', 'pc.participantCurrencyId', 'tp.participantCurrencyId')
          .select(
            'settlementWindow.settlementWindowId',
            'swsc.settlementWindowStateId as state',
            'swsc.reason as reason',
            'settlementWindow.createdDate as createdDate',
            'swsc.createdDate as changedDate'
          )
          .orderBy('changedDate', 'desc').distinct()
          .where('pc.participantId', participantId)
        if (state) { b.where('swsc.settlementWindowStateId', state) }
        if (fromDateTime) { b.where('settlementWindow.createdDate', '>=', fromDateTime) }
        if (toDateTime) { b.where('settlementWindow.createdDate', '<=', toDateTime) }
        if (currency) { b.where('pc.currencyId', currency) }
        return b
      }
    })
  },

  process: async function ({ settlementWindowId, reason }, enums = {}) {
    const knex = await Db.getKnex()
    const settlementWindowCurrentState = await Facade.getById({ settlementWindowId })
    const transfersCount = (await Facade.getTransfersCount({ settlementWindowId })).cnt
    if (!settlementWindowCurrentState) {
      throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Window ${settlementWindowId} does not exist`)
    } if (settlementWindowCurrentState && settlementWindowCurrentState.state !== enums.OPEN) {
      throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Window ${settlementWindowId} is not open`)
    } if (transfersCount === 0) {
      throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Window ${settlementWindowId} is empty`)
    } else {
      return knex.transaction(async (trx) => {
        try {
          const transactionTimestamp = new Date()
          const settlementWindowStateChangeId = await knex('settlementWindowStateChange').transacting(trx)
            .insert({
              settlementWindowStateId: enums.PROCESSING,
              reason,
              settlementWindowId,
              createdDate: transactionTimestamp
            })
          await knex('settlementWindow').transacting(trx)
            .where({ settlementWindowId })
            .update({ currentStateChangeId: settlementWindowStateChangeId })
          const newSettlementWindowId = await knex('settlementWindow').transacting(trx)
            .insert({ reason, createdDate: transactionTimestamp })
          const newSettlementWindowStateChangeId = await knex('settlementWindowStateChange').transacting(trx)
            .insert({
              settlementWindowId: newSettlementWindowId[0],
              settlementWindowStateId: enums.OPEN,
              reason,
              createdDate: transactionTimestamp
            })
          await knex('settlementWindow').transacting(trx)
            .where({ settlementWindowId: newSettlementWindowId[0] })
            .update({ currentStateChangeId: newSettlementWindowStateChangeId })
          return newSettlementWindowId[0]
        } catch (err) {
          logger.error(err)
          throw ErrorHandler.Factory.reformatFSPIOPError(err)
        }
      })
        .catch((err) => {
          logger.error(err)
          throw ErrorHandler.Factory.reformatFSPIOPError(err)
        })
    }
  },

  close: async function (settlementWindowId, reason) {
    const knex = await Db.getKnex()
    const settlementWindowCurrentState = await Facade.getById({ settlementWindowId })
    if (!settlementWindowCurrentState) {
      throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Window ${settlementWindowId} does not exist`)
    } if (settlementWindowCurrentState && settlementWindowCurrentState.state !== Enum.Settlements.SettlementWindowState.PROCESSING) {
      throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Window ${settlementWindowId} is not in processing state`)
    } else {
      return knex.transaction(async (trx) => {
        try {
          const transactionTimestamp = new Date()
          // Insert settlementWindowContent
          const allSettlementModels = await SettlementModelModel.getAll()
          const smMap = {}

          for (const sm of allSettlementModels) {
            smMap[sm.settlementModelId] = sm
          }
          const settlementModelCurrenciesList = allSettlementModels.filter(record => record.currencyId !== null).map(record => record.currencyId)

          // To avoid inconsistencies under READ COMMITTED isolation level, transferFulfilment
          // is read only once. Without this, a transfer committed between the two reads would
          // appear in settlementContentAggregation but not in settlementWindowContent, producing
          // wrong net amounts. The temp table fixes one consistent snapshot for both operations.
          await knex.raw('DROP TEMPORARY TABLE IF EXISTS tmp_swc_agg').transacting(trx)
          // Inner subquery assigns role per individual change row (matching original
          // CASE WHEN unioned.change > 0 semantics), outer GROUP BY then sums per
          // (content, participant, role) — preserving the original aggregation shape.
          await knex.raw(`
            CREATE TEMPORARY TABLE tmp_swc_agg AS
            SELECT
              ledgerAccountTypeId,
              currencyId,
              settlementModelId,
              participantCurrencyId,
              transferParticipantRoleTypeId,
              ledgerEntryTypeId,
              SUM(amount) AS amount
            FROM (
              SELECT
                pc.ledgerAccountTypeId,
                pc.currencyId,
                m.settlementModelId,
                pc.participantCurrencyId,
                CASE WHEN base.change > 0 THEN ? ELSE ? END AS transferParticipantRoleTypeId,
                ? AS ledgerEntryTypeId,
                base.change AS amount
              FROM (
                SELECT ppc.participantCurrencyId, ppc.change
                FROM transferFulfilment AS tf
                JOIN transferStateChange AS tsc ON tsc.transferId = tf.transferId
                JOIN participantPositionChange AS ppc ON ppc.transferStateChangeId = tsc.transferStateChangeId
                WHERE tf.settlementWindowId = ?
                UNION ALL
                SELECT ppc.participantCurrencyId, ppc.change
                FROM fxTransferFulfilment AS ftf
                JOIN fxTransferStateChange AS ftsc ON ftsc.commitRequestId = ftf.commitRequestId
                JOIN participantPositionChange AS ppc ON ppc.fxTransferStateChangeId = ftsc.fxTransferStateChangeId
                WHERE ftf.settlementWindowId = ?
              ) AS base
              JOIN participantCurrency AS pc ON pc.participantCurrencyId = base.participantCurrencyId
              JOIN settlementModel AS m ON m.ledgerAccountTypeId = pc.ledgerAccountTypeId
              WHERE m.settlementGranularityId = ?
            ) AS enriched
            GROUP BY
              ledgerAccountTypeId, currencyId, settlementModelId,
              participantCurrencyId, transferParticipantRoleTypeId, ledgerEntryTypeId
          `, [
            Enum.Accounts.TransferParticipantRoleType.PAYER_DFSP,
            Enum.Accounts.TransferParticipantRoleType.PAYEE_DFSP,
            Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE,
            settlementWindowId,
            settlementWindowId,
            Enum.Settlements.SettlementGranularity.NET
          ]).transacting(trx)

          // Derive distinct swc combinations from temp table — no second read of transferFulfilment
          const [swcDistinct] = await knex.raw(
            'SELECT DISTINCT ledgerAccountTypeId, currencyId, settlementModelId FROM tmp_swc_agg'
          ).transacting(trx)

          // Insert settlementWindowContent — same smMap filtering as before
          const promiseArray = []
          for (const row of swcDistinct) {
            const currentModel = smMap[row.settlementModelId]
            if (currentModel && currentModel.settlementModelId === row.settlementModelId) {
              if ((currentModel.currencyId === row.currencyId) ||
                (!settlementModelCurrenciesList.includes(row.currencyId) && currentModel.currencyId === null)) { // is default settlement model
                promiseArray.push(knex('settlementWindowContent').transacting(trx).insert({
                  settlementWindowId,
                  ledgerAccountTypeId: row.ledgerAccountTypeId,
                  currencyId: row.currencyId,
                  settlementModelId: row.settlementModelId,
                  createdDate: transactionTimestamp
                }))
              }
            }
          }
          await Promise.all(promiseArray)

          // Insert settlementContentAggregation from temp table — no second read of transferFulfilment
          let builder = knex.raw(`
            INSERT INTO settlementContentAggregation
              (settlementWindowContentId, participantCurrencyId, transferParticipantRoleTypeId, ledgerEntryTypeId, currentStateId, createdDate, amount)
            SELECT
              swc.settlementWindowContentId,
              t.participantCurrencyId,
              t.transferParticipantRoleTypeId,
              t.ledgerEntryTypeId,
              ?, ?,
              t.amount
            FROM tmp_swc_agg t
            JOIN settlementWindowContent swc
              ON swc.settlementWindowId = ?
              AND swc.ledgerAccountTypeId = t.ledgerAccountTypeId
              AND swc.currencyId = t.currencyId
              AND swc.settlementModelId = t.settlementModelId
          `, [
            Enum.Settlements.SettlementWindowState.CLOSED,
            transactionTimestamp,
            settlementWindowId
          ]).transacting(trx)
          await builder

          await knex.raw('DROP TEMPORARY TABLE IF EXISTS tmp_swc_agg').transacting(trx)

          // Insert settlementWindowContentStateChange
          builder = knex
            .from(knex.raw('settlementWindowContentStateChange (settlementWindowContentId, settlementWindowStateId, reason, createdDate)'))
            .insert(/* istanbul ignore next */ function () {
              this.from('settlementWindowContent AS swc')
                .where('swc.settlementWindowId', settlementWindowId)
                .select('swc.settlementWindowContentId',
                  knex.raw('? AS ??', [Enum.Settlements.SettlementWindowState.CLOSED, 'settlementWindowStateId']),
                  knex.raw('? AS ??', [reason, 'reason']),
                  knex.raw('? AS ??', [transactionTimestamp, 'createdDate']))
            })
            .transacting(trx)
          await builder

          // Update settlementWindowContent pointers to current states, inserted by previous command
          const settlementWindowContentStateChangeList = await knex('settlementWindowContentStateChange AS swcsc')
            .join('settlementWindowContent AS swc', 'swc.settlementWindowContentId', 'swcsc.settlementWindowContentId')
            .select('swc.settlementWindowContentId', 'swcsc.settlementWindowContentStateChangeId')
            .where('swc.settlementWindowId', settlementWindowId)
            .transacting(trx)
          const updatePromises = []
          for (const i in settlementWindowContentStateChangeList) {
            const updatedColumns = { currentStateChangeId: settlementWindowContentStateChangeList[i].settlementWindowContentStateChangeId }
            updatePromises.push(
              knex('settlementWindowContent')
                .where('settlementWindowContentId', settlementWindowContentStateChangeList[i].settlementWindowContentId)
                .update(updatedColumns)
                .transacting(trx)
            )
          }
          await Promise.all(updatePromises)

          const settlementWindowStateChangeId = await knex('settlementWindowStateChange')
            .insert({
              settlementWindowStateId: Enum.Settlements.SettlementWindowState.CLOSED,
              reason,
              settlementWindowId,
              createdDate: transactionTimestamp
            })
            .transacting(trx)
          await knex('settlementWindow')
            .where({ settlementWindowId })
            .update({ currentStateChangeId: settlementWindowStateChangeId })
            .transacting(trx)

          await knex.raw('DROP TEMPORARY TABLE IF EXISTS tmp_swc_agg').transacting(trx)
          return true
        } catch (err) {
          logger.error(err)
          // Best-effort cleanup so the pooled connection does not carry the temp table forward
          try {
            await knex.raw('DROP TEMPORARY TABLE IF EXISTS tmp_swc_agg').transacting(trx)
          } catch (cleanupErr) {
            logger.warn('Failed to drop temp table during cleanup', cleanupErr)
          }
          throw ErrorHandler.Factory.reformatFSPIOPError(err)
        }
      })
        .catch((err) => {
          logger.error(err)
          throw ErrorHandler.Factory.reformatFSPIOPError(err)
        })
    }
  },

  getBySettlementId: async function ({ settlementId }) {
    return Db.from('settlementSettlementWindow').query(builder => {
      return builder
        .join('settlementWindow AS sw', 'sw.settlementWindowId', 'settlementSettlementWindow.settlementWindowId')
        .join('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'sw.currentStateChangeId')
        .select(
          'sw.settlementWindowId AS id',
          'swsc.settlementWindowStateId as state',
          'swsc.reason as reason',
          'sw.createdDate as createdDate',
          'swsc.createdDate as changedDate'
        )
        .where('settlementSettlementWindow.settlementId', settlementId)
    })
  }
}

module.exports = Facade
