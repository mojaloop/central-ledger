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
          const swcList = await knex
            .from(/* istanbul ignore next */ function () {
              this.select('tf.settlementWindowId', 'ppc.participantCurrencyId')
                .from('transferFulfilment AS tf')
                .join('transferStateChange AS tsc', 'tsc.transferId', 'tf.transferId')
                .join('participantPositionChange AS ppc', 'ppc.transferStateChangeId', 'tsc.transferStateChangeId')
                .where('tf.settlementWindowId', settlementWindowId)
                .unionAll(/* istanbul ignore next */ function () {
                  this.select('ftf.settlementWindowId', 'ppc.participantCurrencyId')
                    .from('fxTransferFulfilment AS ftf')
                    .join('fxTransferStateChange AS ftsc', 'ftsc.commitRequestId', 'ftf.commitRequestId')
                    .join('participantPositionChange AS ppc', 'ppc.fxTransferStateChangeId', 'ftsc.fxTransferStateChangeId')
                    .where('ftf.settlementWindowId', settlementWindowId)
                }).as('unioned')
            }).as('swc')
            .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'unioned.participantCurrencyId')
            .join('settlementModel AS m', 'm.ledgerAccountTypeId', 'pc.ledgerAccountTypeId')
            .where('m.settlementGranularityId', Enum.Settlements.SettlementGranularity.NET)
            .distinct('unioned.settlementWindowId', 'pc.ledgerAccountTypeId', 'pc.currencyId', 'm.settlementModelId')
            .transacting(trx)
          const promiseArray = []
          swcList.forEach(swc => {
            const currentModel = smMap[swc.settlementModelId]
            if (currentModel.settlementModelId === swc.settlementModelId) {
              if ((currentModel.currencyId === swc.currencyId) ||
              (!settlementModelCurrenciesList.includes(swc.currencyId) && currentModel.currencyId === null)) { // is default settlement model
                swc.createdDate = transactionTimestamp
                promiseArray.push(knex('settlementWindowContent').insert(swc).transacting(trx))
              }
            }
          })

          await Promise.all(promiseArray)
          // Insert settlementContentAggregation
          let builder = knex
            .from(knex.raw('settlementContentAggregation (settlementWindowContentId, participantCurrencyId, transferParticipantRoleTypeId, ledgerEntryTypeId, currentStateId, createdDate, amount)'))
            .insert(/* istanbul ignore next */ function () {
              this.from(function () {
                this.select('ppc.participantCurrencyId', 'ppc.change', 'tf.settlementWindowId')
                  .from('transferFulfilment AS tf')
                  .join('transferStateChange AS tsc', 'tsc.transferId', 'tf.transferId')
                  .join('participantPositionChange AS ppc', 'ppc.transferStateChangeId', 'tsc.transferStateChangeId')
                  .where('tf.settlementWindowId', settlementWindowId)
                  .unionAll(/* istanbul ignore next */ function () {
                    this.select('ppc.participantCurrencyId', 'ppc.change', 'fxtf.settlementWindowId')
                      .from('fxTransferFulfilment AS fxtf')
                      .join('fxTransferStateChange AS fxtsc', 'fxtsc.commitRequestId', 'fxtf.commitRequestId')
                      .join('participantPositionChange AS ppc', 'ppc.fxTransferStateChangeId', 'fxtsc.fxTransferStateChangeId')
                      .where('fxtf.settlementWindowId', settlementWindowId)
                  }).as('unioned')
              })
                .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'unioned.participantCurrencyId')
                .join('participant AS p', 'p.participantId', 'pc.participantId')
                .join('settlementWindowContent AS swc', function () {
                  this.on('swc.settlementWindowId', 'unioned.settlementWindowId')
                    .on('swc.ledgerAccountTypeId', 'pc.ledgerAccountTypeId')
                    .on('swc.currencyId', 'pc.currencyId')
                })
                .join('settlementModel AS m', 'm.settlementModelId', 'swc.settlementModelId')
                .andWhere('m.settlementGranularityId', Enum.Settlements.SettlementGranularity.NET)
                .groupBy('swc.settlementWindowContentId', 'pc.participantCurrencyId', 'transferParticipantRoleTypeId', 'ledgerEntryTypeId')
                .select('swc.settlementWindowContentId', 'pc.participantCurrencyId',
                  knex.raw('CASE WHEN unioned.change > 0 THEN ? ELSE ?? END AS transferParticipantRoleTypeId', [Enum.Accounts.TransferParticipantRoleType.PAYER_DFSP, Enum.Accounts.TransferParticipantRoleType.PAYEE_DFSP]),
                  knex.raw('? AS ??', [Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE, 'ledgerEntryTypeId']),
                  knex.raw('? AS ??', [Enum.Settlements.SettlementWindowState.CLOSED, 'settlementWindowStateId']),
                  knex.raw('? AS ??', [transactionTimestamp, 'createdDate']))
                .sum('unioned.change AS amount')
            })
            .transacting(trx)
          await builder

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

          return true
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
