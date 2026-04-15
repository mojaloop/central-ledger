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

const arrayDiff = require('lodash').difference
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const MLNumber = require('@mojaloop/ml-number')
const Db = require('../../lib/db')
const idGenerator = require('@mojaloop/central-services-shared').Util.id
const Crypto = require('crypto')
const Config = require('../../lib/config')

const ParticipantFacade = require('../../../models/participant/facade')
const Utility = require('../../lib/utility')
const SettlementModelModel = require('./settlementModel')
const { logger } = require('../../shared/logger')
const generateULID = idGenerator({ type: 'ulid' })

const groupByWindowsWithContent = (records) => {
  const settlementWindowsAssoc = {}
  for (const record of records) {
    const id = record.settlementWindowId
    if (id in settlementWindowsAssoc) {
      settlementWindowsAssoc[id].content.push({
        id: record.settlementWindowContentId,
        state: record.state,
        ledgerAccountType: record.ledgerAccountType,
        currencyId: record.currencyId,
        createdDate: record.createdDate,
        changedDate: record.changedDate
      })
    } else {
      settlementWindowsAssoc[id] = {
        id,
        state: record.settlementWindowStateId,
        reason: record.reason,
        createdDate: record.createdDate1,
        changedDate: record.changedDate1,
        content: [{
          id: record.settlementWindowContentId,
          state: record.state,
          ledgerAccountType: record.ledgerAccountType,
          currencyId: record.currencyId,
          createdDate: record.createdDate,
          changedDate: record.changedDate
        }]
      }
    }
  }
  const settlementWindows = []
  for (const key of Object.keys(settlementWindowsAssoc)) {
    settlementWindows.push(settlementWindowsAssoc[key])
  }
  return settlementWindows
}

const getNotificationMessage = function (action, destination, payload) {
  return {
    id: generateULID(),
    from: Config.HUB_NAME,
    to: destination,
    type: 'application/json',
    content: {
      headers: {
        'Content-Type': 'application/json',
        Date: new Date().toISOString(),
        'FSPIOP-Source': Config.HUB_NAME,
        'FSPIOP-Destination': destination
      },
      payload
    },
    metadata: {
      event: {
        action
      }
    }
  }
}

/**
 * @param enums.ledgerAccountTypes.HUB_MULTILATERAL_SETTLEMENT
 * @param enums.ledgerEntryTypes
 * @param enums.participantLimitTypes
 * @param enums.settlementStates.PS_TRANSFERS_RECORDED
 * @param enums.settlementStates.PS_TRANSFERS_RESERVED
 * @param enums.settlementStates.PS_TRANSFERS_COMMITTED
 * @param enums.transferParticipantRoleTypes
 * @param enums.transferParticipantRoleTypes.DFSP_POSITION
 * @param enums.transferParticipantRoleTypes.HUB
 * @param enums.transferStates
 */
const settlementTransfersPrepare = async function (settlementId, transactionTimestamp, enums, trx = null) {
  const knex = await Db.getKnex()
  let t // see (t of settlementTransferList) below

  // Retrieve list of PS_TRANSFERS_RECORDED, but not RECEIVED_PREPARE
  const settlementTransferList = await knex('settlementParticipantCurrency AS spc')
    .join('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyId', 'spc.settlementParticipantCurrencyId')
    .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'spc.participantCurrencyId')
    .leftJoin('transferDuplicateCheck AS tdc', 'tdc.transferId', 'spc.settlementTransferId')
    .select('spc.*', 'pc.currencyId', 'pc.participantId')
    .where('spc.settlementId', settlementId)
    .where('spcsc.settlementStateId', enums.settlementStates.PS_TRANSFERS_RECORDED)
    .whereNotNull('spc.settlementTransferId')
    .whereNull('tdc.transferId')
    .transacting(trx)

  const trxFunction = async (trx) => {
    try {
      const hashSha256 = Crypto.createHash('sha256')
      let hash = hashSha256.update(String(t.settlementTransferId))
      hash = hashSha256.digest(hash).toString('base64').slice(0, -1) // removing the trailing '=' as per the specification
      // Insert transferDuplicateCheck
      await knex('transferDuplicateCheck')
        .insert({
          transferId: t.settlementTransferId,
          hash,
          createdDate: transactionTimestamp
        })
        .transacting(trx)

      // Insert transfer
      await knex('transfer')
        .insert({
          transferId: t.settlementTransferId,
          amount: Math.abs(t.netAmount),
          currencyId: t.currencyId,
          ilpCondition: 0,
          expirationDate: new Date(+new Date() + 1000 * Number(Config.TRANSFER_VALIDITY_SECONDS)).toISOString().replace(/[TZ]/g, ' ').trim(),
          createdDate: transactionTimestamp
        })
        .transacting(trx)

      // Retrieve Hub mlns account
      const { mlnsAccountId } = await knex('participantCurrency AS pc1')
        .join('participantCurrency AS pc2', function () {
          this.on('pc2.participantId', Config.HUB_ID)
            .andOn('pc2.currencyId', 'pc1.currencyId')
            .andOn('pc2.ledgerAccountTypeId', enums.ledgerAccountTypes.HUB_MULTILATERAL_SETTLEMENT)
            .andOn('pc2.isActive', 1)
        })
        .select('pc2.participantCurrencyId AS mlnsAccountId')
        .where('pc1.participantCurrencyId', t.participantCurrencyId)
        .first()
        .transacting(trx)

      let ledgerEntryTypeId
      if (t.netAmount < 0) {
        ledgerEntryTypeId = enums.ledgerEntryTypes.SETTLEMENT_NET_RECIPIENT
      } else if (t.netAmount > 0) {
        ledgerEntryTypeId = enums.ledgerEntryTypes.SETTLEMENT_NET_SENDER
      } else { // t.netAmount === 0
        ledgerEntryTypeId = enums.ledgerEntryTypes.SETTLEMENT_NET_ZERO
      }

      // Insert transferParticipant records
      await knex('transferParticipant')
        .insert({
          transferId: t.settlementTransferId,
          participantCurrencyId: mlnsAccountId,
          transferParticipantRoleTypeId: enums.transferParticipantRoleTypes.HUB,
          ledgerEntryTypeId,
          amount: t.netAmount,
          createdDate: transactionTimestamp,
          participantId: Config.HUB_ID
        })
        .transacting(trx)
      await knex('transferParticipant')
        .insert({
          transferId: t.settlementTransferId,
          participantCurrencyId: t.participantCurrencyId,
          transferParticipantRoleTypeId: enums.transferParticipantRoleTypes.DFSP_POSITION,
          ledgerEntryTypeId,
          amount: -t.netAmount,
          createdDate: transactionTimestamp,
          participantId: t.participantId
        })
        .transacting(trx)

      // Insert transferStateChange
      await knex('transferStateChange')
        .insert({
          transferId: t.settlementTransferId,
          transferStateId: enums.transferStates.RECEIVED_PREPARE,
          reason: 'Settlement transfer prepare',
          createdDate: transactionTimestamp
        })
        .transacting(trx)
    } catch (err) {
      logger.error(err)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  for (t of settlementTransferList) {
    if (trx) {
      await trxFunction(trx)
    } else {
      await knex.transaction(trxFunction)
    }
  }
  return 0
}

/**
 * @param enums.ledgerAccountTypes.HUB_MULTILATERAL_SETTLEMENT
 * @param enums.ledgerEntryTypes
 * @param enums.participantLimitTypes
 * @param enums.settlementStates.PS_TRANSFERS_RECORDED
 * @param enums.settlementStates.PS_TRANSFERS_RESERVED
 * @param enums.settlementStates.PS_TRANSFERS_COMMITTED
 * @param enums.transferParticipantRoleTypes
 * @param enums.transferParticipantRoleTypes.DFSP_POSITION
 * @param enums.transferParticipantRoleTypes.HUB
 * @param enums.transferStates
 */
const settlementTransfersReserve = async function (settlementId, transactionTimestamp, requireLiquidityCheck, enums, trx = null) {
  const knex = await Db.getKnex()
  let isLimitExceeded, transferStateChangeId
  // Retrieve list of PS_TRANSFERS_RESERVED, but not RESERVED
  const settlementTransferList = await knex('settlementParticipantCurrency AS spc')
    .join('settlementParticipantCurrencyStateChange AS spcsc', function () {
      this.on('spcsc.settlementParticipantCurrencyId', 'spc.settlementParticipantCurrencyId')
        .andOn('spcsc.settlementStateId', knex.raw('?', [enums.settlementStates.PS_TRANSFERS_RESERVED]))
    })
    .join('transferStateChange AS tsc1', function () {
      this.on('tsc1.transferId', 'spc.settlementTransferId')
        .andOn('tsc1.transferStateId', knex.raw('?', [enums.transferStates.RECEIVED_PREPARE]))
    })
    .leftJoin('transferStateChange AS tsc2', function () {
      this.on('tsc2.transferId', 'spc.settlementTransferId')
        .andOn('tsc2.transferStateId', knex.raw('?', [enums.transferStates.RESERVED]))
    })
    .join('transferParticipant AS tp1', function () {
      this.on('tp1.transferId', 'spc.settlementTransferId')
        .andOn('tp1.transferParticipantRoleTypeId', knex.raw('?', [enums.transferParticipantRoleTypes.DFSP_POSITION]))
    })
    .join('participantCurrency AS pc1', 'pc1.participantCurrencyId', 'tp1.participantCurrencyId')
    .join('participant AS p1', 'p1.participantId', 'pc1.participantId')
    .join('transferParticipant AS tp2', function () {
      this.on('tp2.transferId', 'spc.settlementTransferId')
        .andOn('tp2.transferParticipantRoleTypeId', knex.raw('?', [enums.transferParticipantRoleTypes.HUB]))
    })
    .select('tp1.transferId', 'tp1.ledgerEntryTypeId', 'tp1.participantCurrencyId AS dfspAccountId', 'tp1.amount AS dfspAmount',
      'tp2.participantCurrencyId AS hubAccountId', 'tp2.amount AS hubAmount',
      'p1.name AS dfspName', 'pc1.currencyId')
    .where('spc.settlementId', settlementId)
    .whereNull('tsc2.transferId')
    .transacting(trx)

  const trxFunction = async (trx) => {
    try {
      for (const {
        transferId, ledgerEntryTypeId, dfspAccountId, dfspAmount, hubAccountId, hubAmount,
        dfspName, currencyId
      } of settlementTransferList) {
        // Persist transfer state change
        transferStateChangeId = await knex('transferStateChange')
          .insert({
            transferId,
            transferStateId: enums.transferStates.RESERVED,
            reason: 'Settlement transfer reserve',
            createdDate: transactionTimestamp
          })
          .transacting(trx)

        if (ledgerEntryTypeId === enums.ledgerEntryTypes.SETTLEMENT_NET_RECIPIENT) {
          // Select dfspPosition FOR UPDATE
          const { dfspPositionId, dfspPositionValue, dfspReservedValue } = await knex('participantPosition')
            .select('participantPositionId AS dfspPositionId', 'value AS dfspPositionValue', 'reservedValue AS dfspReservedValue')
            .where('participantCurrencyId', dfspAccountId)
            .first()
            .transacting(trx)
            .forUpdate()

          if (requireLiquidityCheck) { // TODO: This is not a liquidity check, but rather a limit-check since we are only checking against the NED-DEBIT-CAP!
            // Select dfsp NET_DEBIT_CAP limit
            const { netDebitCap } = await knex('participantLimit')
              .select('value AS netDebitCap')
              .where('participantCurrencyId', dfspAccountId)
              .andWhere('participantLimitTypeId', enums.participantLimitTypes.NET_DEBIT_CAP)
              .first()
              .transacting(trx)
              .forUpdate()
            isLimitExceeded = netDebitCap - dfspPositionValue - dfspReservedValue - dfspAmount < 0

            if (isLimitExceeded) {
              /* let { startAfterParticipantPositionChangeId } = */
              await knex('participantPositionChange')
                .select('participantPositionChangeId AS startAfterParticipantPositionChangeId')
                .where('participantPositionId', dfspPositionId)
                .orderBy('participantPositionChangeId', 'desc')
                .first()
                .transacting(trx)

              // TODO:: notify dfsp for NDC change
              // TODO:: insert new limit with correct value for startAfterParticipantPositionChangeId
              await ParticipantFacade.adjustLimits(dfspAccountId, {
                type: 'NET_DEBIT_CAP',
                value: new MLNumber(netDebitCap).add(dfspAmount).toNumber()
              }, trx)
            }
          }

          // Persist dfsp latestPosition
          await knex('participantPosition')
            .update('value', new MLNumber(dfspPositionValue).add(dfspAmount).toNumber())
            .where('participantPositionId', dfspPositionId)
            .transacting(trx)

          // Persist dfsp position change
          await knex('participantPositionChange')
            .insert({
              participantPositionId: dfspPositionId,
              participantCurrencyId: dfspAccountId,
              transferStateChangeId,
              value: new MLNumber(dfspPositionValue).add(dfspAmount).toNumber(),
              change: new MLNumber(dfspAmount).toNumber(),
              reservedValue: dfspReservedValue,
              createdDate: transactionTimestamp
            })
            .transacting(trx)

          // Send notification for position change
          const action = 'settlement-transfer-position-change'
          const destination = dfspName
          const payload = {
            currency: currencyId,
            value: new MLNumber(dfspPositionValue).add(dfspAmount).toNumber(),
            changedDate: new Date().toISOString()
          }
          const message = Facade.getNotificationMessage(action, destination, payload)
          await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message, Utility.ENUMS.STATE.SUCCESS)

          // Select hubPosition FOR UPDATE
          const { hubPositionId, hubPositionValue } = await knex('participantPosition')
            .select('participantPositionId AS hubPositionId', 'value AS hubPositionValue')
            .where('participantCurrencyId', hubAccountId)
            .first()
            .transacting(trx)
            .forUpdate()

          // Persist hub latestPosition
          await knex('participantPosition')
            .update('value', new MLNumber(hubPositionValue).add(hubAmount).toNumber())
            .where('participantPositionId', hubPositionId)
            .transacting(trx)

          // Persist hub position change
          await knex('participantPositionChange')
            .insert({
              participantPositionId: hubPositionId,
              participantCurrencyId: hubAccountId,
              transferStateChangeId,
              value: new MLNumber(hubPositionValue).add(hubAmount).toNumber(),
              change: new MLNumber(hubAmount).toNumber(),
              reservedValue: 0,
              createdDate: transactionTimestamp
            })
            .transacting(trx)
        }
      }
    } catch (err) {
      logger.error(err)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  if (trx) {
    await trxFunction(trx)
  } else {
    await knex.transaction(trxFunction)
  }
  return 0
}

/**
 * @param enums.ledgerAccountTypes.HUB_MULTILATERAL_SETTLEMENT
 * @param enums.ledgerEntryTypes
 * @param enums.participantLimitTypes
 * @param enums.settlementStates.PS_TRANSFERS_RECORDED
 * @param enums.settlementStates.PS_TRANSFERS_RESERVED
 * @param enums.settlementStates.PS_TRANSFERS_COMMITTED
 * @param enums.transferParticipantRoleTypes
 * @param enums.transferParticipantRoleTypes.DFSP_POSITION
 * @param enums.transferParticipantRoleTypes.HUB
 * @param enums.transferStates
 */
const settlementTransfersAbort = async function (settlementId, transactionTimestamp, enums, trx = null) {
  const knex = await Db.getKnex()
  let transferStateChangeId

  // Retrieve list of ABORTED, but not ABORTED
  const settlementTransferList = await knex('settlementParticipantCurrency AS spc')
    .join('settlementParticipantCurrencyStateChange AS spcsc', function () {
      this.on('spcsc.settlementParticipantCurrencyId', 'spc.settlementParticipantCurrencyId')
        .andOn('spcsc.settlementStateId', knex.raw('?', [enums.settlementStates.ABORTED]))
    })
    .leftJoin('transferStateChange AS tsc1', 'tsc1.transferId', 'spc.settlementTransferId')
    .leftJoin('transferState AS ts1', function () {
      this.on('ts1.transferStateId', 'tsc1.transferStateId')
        .andOn('ts1.enumeration', knex.raw('?', [enums.transferStateEnums.RESERVED]))
    })
    .leftJoin('transferStateChange AS tsc2', 'tsc2.transferId', 'spc.settlementTransferId')
    .leftJoin('transferState AS ts2', function () {
      this.on('ts2.transferStateId', 'tsc2.transferStateId')
        .andOn('ts2.enumeration', knex.raw('?', [enums.transferStateEnums.ABORTED]))
    })
    .join('transferParticipant AS tp1', function () {
      this.on('tp1.transferId', 'spc.settlementTransferId')
        .andOn('tp1.transferParticipantRoleTypeId', knex.raw('?', [enums.transferParticipantRoleTypes.DFSP_POSITION]))
    })
    .join('participantCurrency AS pc1', 'pc1.participantCurrencyId', 'tp1.participantCurrencyId')
    .join('participant AS p1', 'p1.participantId', 'pc1.participantId')
    .join('transferParticipant AS tp2', function () {
      this.on('tp2.transferId', 'spc.settlementTransferId')
        .andOn('tp2.transferParticipantRoleTypeId', knex.raw('?', [enums.transferParticipantRoleTypes.HUB]))
    })
    .select('tp1.transferId', 'tp1.ledgerEntryTypeId', 'tp1.participantCurrencyId AS dfspAccountId', 'tp1.amount AS dfspAmount',
      'tp2.participantCurrencyId AS hubAccountId', 'tp2.amount AS hubAmount', 'tsc1.transferId AS isReserved',
      'p1.name AS dfspName', 'pc1.currencyId')
    .where('spc.settlementId', settlementId)
    .whereNull('tsc2.transferId')
    .transacting(trx)

  const trxFunction = async (trx) => {
    try {
      for (const {
        transferId, ledgerEntryTypeId, dfspAccountId, dfspAmount, hubAccountId, hubAmount, isReserved,
        dfspName, currencyId
      } of settlementTransferList) {
        // Persist transfer state change
        await knex('transferStateChange')
          .insert({
            transferId,
            transferStateId: enums.transferStates.REJECTED,
            reason: 'Settlement transfer reject',
            createdDate: transactionTimestamp
          })
          .transacting(trx)
        transferStateChangeId = await knex('transferStateChange')
          .insert({
            transferId,
            transferStateId: enums.transferStates.ABORTED,
            reason: 'Settlement transfer abort',
            createdDate: transactionTimestamp
          })
          .transacting(trx)

        if (isReserved !== null && ledgerEntryTypeId === enums.ledgerEntryTypes.SETTLEMENT_NET_RECIPIENT) {
          // Select dfspPosition FOR UPDATE
          const { dfspPositionId, dfspPositionValue, dfspReservedValue } = await knex('participantPosition')
            .select('participantPositionId AS dfspPositionId', 'value AS dfspPositionValue', 'reservedValue AS dfspReservedValue')
            .where('participantCurrencyId', dfspAccountId)
            .first()
            .transacting(trx)
            .forUpdate()

          // Persist dfsp latestPosition
          await knex('participantPosition')
            .update('value', dfspPositionValue - dfspAmount)
            .where('participantPositionId', dfspPositionId)
            .transacting(trx)

          // Persist dfsp position change
          await knex('participantPositionChange')
            .insert({
              participantPositionId: dfspPositionId,
              participantCurrencyId: dfspAccountId,
              transferStateChangeId,
              value: dfspPositionValue - dfspAmount,
              change: new MLNumber(dfspAmount).toNumber(),
              reservedValue: dfspReservedValue,
              createdDate: transactionTimestamp
            })
            .transacting(trx)

          // Send notification for position change
          const action = 'settlement-transfer-position-change'
          const destination = dfspName
          const payload = {
            currency: currencyId,
            value: dfspPositionValue - dfspAmount,
            changedDate: new Date().toISOString()
          }
          const message = Facade.getNotificationMessage(action, destination, payload)
          await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message, Utility.ENUMS.STATE.SUCCESS)

          // Select hubPosition FOR UPDATE
          const { hubPositionId, hubPositionValue } = await knex('participantPosition')
            .select('participantPositionId AS hubPositionId', 'value AS hubPositionValue')
            .where('participantCurrencyId', hubAccountId)
            .first()
            .transacting(trx)
            .forUpdate()

          // Persist hub latestPosition
          await knex('participantPosition')
            .update('value', hubPositionValue - hubAmount)
            .where('participantPositionId', hubPositionId)
            .transacting(trx)

          // Persist hub position change
          await knex('participantPositionChange')
            .insert({
              participantPositionId: hubPositionId,
              participantCurrencyId: hubAccountId,
              transferStateChangeId,
              value: hubPositionValue - hubAmount,
              change: new MLNumber(hubAmount).toNumber(),
              reservedValue: 0,
              createdDate: transactionTimestamp
            })
            .transacting(trx)
        }
      }
    } catch (err) {
      logger.error(err)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  if (trx) {
    await trxFunction(trx)
  } else {
    await knex.transaction(trxFunction)
  }
  return 0
}

/**
 * @param enums.ledgerAccountTypes.HUB_MULTILATERAL_SETTLEMENT
 * @param enums.ledgerEntryTypes
 * @param enums.participantLimitTypes
 * @param enums.settlementStates.PS_TRANSFERS_RECORDED
 * @param enums.settlementStates.PS_TRANSFERS_RESERVED
 * @param enums.settlementStates.PS_TRANSFERS_COMMITTED
 * @param enums.transferParticipantRoleTypes
 * @param enums.transferParticipantRoleTypes.DFSP_POSITION
 * @param enums.transferParticipantRoleTypes.HUB
 * @param enums.transferStates
 */
const settlementTransfersCommit = async function (settlementId, transactionTimestamp, enums, trx = null) {
  const knex = await Db.getKnex()
  let transferStateChangeId

  // Retrieve list of PS_TRANSFERS_COMMITTED, but not COMMITTED
  const settlementTransferList = await knex('settlementParticipantCurrency AS spc')
    .join('settlementParticipantCurrencyStateChange AS spcsc', function () {
      this.on('spcsc.settlementParticipantCurrencyId', 'spc.settlementParticipantCurrencyId')
        .andOn('spcsc.settlementStateId', knex.raw('?', [enums.settlementStates.PS_TRANSFERS_COMMITTED]))
    })
    .join('transferStateChange AS tsc1', function () {
      this.on('tsc1.transferId', 'spc.settlementTransferId')
        .andOn('tsc1.transferStateId', knex.raw('?', [enums.transferStates.RESERVED]))
    })
    .leftJoin('transferStateChange AS tsc2', function () {
      this.on('tsc2.transferId', 'spc.settlementTransferId')
        .andOn('tsc2.transferStateId', knex.raw('?', [enums.transferStates.COMMITTED]))
    })
    .join('transferParticipant AS tp1', function () {
      this.on('tp1.transferId', 'spc.settlementTransferId')
        .andOn('tp1.transferParticipantRoleTypeId', knex.raw('?', [enums.transferParticipantRoleTypes.DFSP_POSITION]))
    })
    .join('participantCurrency AS pc1', 'pc1.participantCurrencyId', 'tp1.participantCurrencyId')
    .join('participant AS p1', 'p1.participantId', 'pc1.participantId')
    .join('transferParticipant AS tp2', function () {
      this.on('tp2.transferId', 'spc.settlementTransferId')
        .andOn('tp2.transferParticipantRoleTypeId', knex.raw('?', [enums.transferParticipantRoleTypes.HUB]))
    })
    .select('tp1.transferId', 'tp1.ledgerEntryTypeId', 'tp1.participantCurrencyId AS dfspAccountId', 'tp1.amount AS dfspAmount',
      'tp2.participantCurrencyId AS hubAccountId', 'tp2.amount AS hubAmount',
      'p1.name AS dfspName', 'pc1.currencyId')
    .where('spc.settlementId', settlementId)
    .whereNull('tsc2.transferId')
    .transacting(trx)

  const trxFunction = async (trx) => {
    try {
      for (const {
        transferId, ledgerEntryTypeId, dfspAccountId, dfspAmount, hubAccountId, hubAmount,
        dfspName, currencyId
      } of settlementTransferList) {
        // Persist transfer fulfilment and transfer state change
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

        await knex('transferStateChange')
          .insert({
            transferId,
            transferStateId: enums.transferStates.RECEIVED_FULFIL,
            reason: 'Settlement transfer commit initiated',
            createdDate: transactionTimestamp
          })
          .transacting(trx)

        transferStateChangeId = await knex('transferStateChange')
          .insert({
            transferId,
            transferStateId: enums.transferStates.COMMITTED,
            reason: 'Settlement transfer commit',
            createdDate: transactionTimestamp
          })
          .transacting(trx)

        if (ledgerEntryTypeId === enums.ledgerEntryTypes.SETTLEMENT_NET_SENDER) {
          // Select dfspPosition FOR UPDATE
          const { dfspPositionId, dfspPositionValue, dfspReservedValue } = await knex('participantPosition')
            .select('participantPositionId AS dfspPositionId', 'value AS dfspPositionValue', 'reservedValue AS dfspReservedValue')
            .where('participantCurrencyId', dfspAccountId)
            .first()
            .transacting(trx)
            .forUpdate()

          // Persist dfsp latestPosition
          await knex('participantPosition')
            .update('value', new MLNumber(dfspPositionValue).add(dfspAmount).toNumber())
            .where('participantPositionId', dfspPositionId)
            .transacting(trx)

          // Persist dfsp position change
          await knex('participantPositionChange')
            .insert({
              participantPositionId: dfspPositionId,
              participantCurrencyId: dfspAccountId,
              transferStateChangeId,
              value: new MLNumber(dfspPositionValue).add(dfspAmount).toNumber(),
              change: new MLNumber(dfspAmount).toNumber(),
              reservedValue: dfspReservedValue,
              createdDate: transactionTimestamp
            })
            .transacting(trx)

          // Select hubPosition FOR UPDATE
          const { hubPositionId, hubPositionValue } = await knex('participantPosition')
            .select('participantPositionId AS hubPositionId', 'value AS hubPositionValue')
            .where('participantCurrencyId', hubAccountId)
            .first()
            .transacting(trx)
            .forUpdate()

          // Persist hub latestPosition
          await knex('participantPosition')
            .update('value', new MLNumber(hubPositionValue).add(hubAmount).toNumber())
            .where('participantPositionId', hubPositionId)
            .transacting(trx)

          // Persist hub position change
          await knex('participantPositionChange')
            .insert({
              participantPositionId: hubPositionId,
              participantCurrencyId: hubAccountId,
              transferStateChangeId,
              value: new MLNumber(hubPositionValue).add(hubAmount).toNumber(),
              change: new MLNumber(hubAmount).toNumber(),
              reservedValue: 0,
              createdDate: transactionTimestamp
            })
            .transacting(trx)

          // Send notification for position change
          const action = 'settlement-transfer-position-change'
          const destination = dfspName
          const payload = {
            currency: currencyId,
            value: new MLNumber(dfspPositionValue).add(dfspAmount).toNumber(),
            changedDate: new Date().toISOString()
          }
          const message = Facade.getNotificationMessage(action, destination, payload)
          await Utility.produceGeneralMessage(Utility.ENUMS.NOTIFICATION, Utility.ENUMS.EVENT, message, Utility.ENUMS.STATE.SUCCESS)
        }
      }
    } catch (err) {
      logger.error(err)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  if (trx) {
    await trxFunction(trx)
  } else {
    await knex.transaction(trxFunction)
  }
  return 0
}

const abortByIdStateAborted = async (settlementId, payload, enums) => {
  const knex = await Db.getKnex()
  // seq-settlement-6.2.6, step 5
  const settlementStateChangeId = await knex('settlementStateChange')
    .insert({
      settlementId,
      settlementStateId: enums.settlementStates.ABORTED,
      reason: payload.reason
    })
  // seq-settlement-6.2.6, step 5a
  await knex('settlement')
    .where('settlementId', settlementId)
    .update({ currentStateChangeId: settlementStateChangeId[0] })

  return {
    id: settlementId,
    state: payload.state,
    reason: payload.reason
  }
}

const getTransferCommitedAccount = async (settlementId, enums) => {
  const knex = await Db.getKnex()
  // seq-settlement-6.2.6, step 6
  return await knex('settlementParticipantCurrency AS spc')
    .join('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'spc.currentStateChangeId')
    .where('spc.settlementId', settlementId)
    .where('spcsc.settlementStateId', enums.settlementStates.PS_TRANSFERS_COMMITTED)
    .first()
}

const Facade = {

  abortByIdStateAborted,
  getTransferCommitedAccount,
  getNotificationMessage,
  settlementTransfersPrepare,
  settlementTransfersReserve,
  settlementTransfersAbort,
  settlementTransfersCommit,

  /**
   * @param enums.ledgerAccountTypes.HUB_MULTILATERAL_SETTLEMENT
   * @param enums.ledgerEntryTypes
   * @param enums.participantLimitTypes
   * @param enums.settlementStates.PS_TRANSFERS_RECORDED
   * @param enums.settlementStates.PS_TRANSFERS_RESERVED
   * @param enums.settlementStates.PS_TRANSFERS_COMMITTED
   * @param enums.settlementStates.SETTLING
   * @param enums.settlementWindowStates
   * @param enums.transferParticipantRoleTypes
   * @param enums.transferParticipantRoleTypes.DFSP_POSITION
   * @param enums.transferParticipantRoleTypes.HUB
   * @param enums.transferStates
   */
  putById: async function (settlementId, payload, enums) {
    const knex = await Db.getKnex()
    return knex.transaction(async (trx) => {
      try {
        const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()

        // seq-settlement-6.2.5, step 3
        const settlementData = await knex('settlement AS s')
          .join('settlementStateChange AS ssc', 'ssc.settlementStateChangeId', 's.currentStateChangeId')
          .join('settlementModel AS sm', 'sm.settlementModelId', 's.settlementModelId')
          .select('s.settlementId', 'ssc.settlementStateId', 'ssc.reason', 'ssc.createdDate', 'sm.autoPositionReset', 'sm.requireLiquidityCheck')
          .where('s.settlementId', settlementId)
          .first()
          .transacting(trx)
          .forUpdate()

        if (!settlementData) {
          throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, 'Settlement not found')
        } else {
          const autoPositionReset = settlementData.autoPositionReset
          delete settlementData.autoPositionReset
          const requireLiquidityCheck = settlementData.requireLiquidityCheck
          delete settlementData.requireLiquidityCheck

          // seq-settlement-6.2.5, step 5
          const settlementAccountList = await knex('settlementParticipantCurrency AS spc')
            .leftJoin('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'spc.currentStateChangeId')
            .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'spc.participantCurrencyId')
            .select('pc.participantId', 'spc.participantCurrencyId', 'spcsc.settlementStateId', 'spcsc.reason', 'spc.netAmount', 'pc.currencyId', 'spc.settlementParticipantCurrencyId AS key'
            )
            .where('spc.settlementId', settlementId)
            .transacting(trx)
            .forUpdate()

          // seq-settlement-6.2.5, step 7
          const settlementAccounts = {
            pendingSettlementCount: 0,
            psTransfersRecordedCount: 0,
            psTransfersReservedCount: 0,
            psTransfersCommittedCount: 0,
            settledCount: 0,
            abortedCount: 0,
            unknownCount: 0,
            settledIdList: [],
            changedIdList: []
          }
          const allAccounts = new Map()

          // seq-settlement-6.2.5, step 8
          for (const account of settlementAccountList) {
            const pid = account.participantId
            const aid = account.participantCurrencyId
            const state = account.settlementStateId
            allAccounts[aid] = {
              id: aid,
              state,
              reason: account.reason,
              createDate: account.createdDate,
              netSettlementAmount: {
                amount: account.netAmount,
                currency: account.currencyId
              },
              participantId: pid,
              key: account.key
            }

            // seq-settlement-6.2.5, step 9
            switch (state) {
              case enums.settlementStates.PENDING_SETTLEMENT: {
                settlementAccounts.pendingSettlementCount++
                break
              }
              case enums.settlementStates.PS_TRANSFERS_RECORDED: {
                settlementAccounts.psTransfersRecordedCount++
                break
              }
              case enums.settlementStates.PS_TRANSFERS_RESERVED: {
                settlementAccounts.psTransfersReservedCount++
                break
              }
              case enums.settlementStates.PS_TRANSFERS_COMMITTED: {
                settlementAccounts.psTransfersCommittedCount++
                break
              }
              case enums.settlementStates.SETTLED: {
                settlementAccounts.settledCount++
                break
              }
              case enums.settlementStates.ABORTED: {
                settlementAccounts.abortedCount++
                break
              }
              default: {
                settlementAccounts.unknownCount++
                break
              }
            }
          }
          // seq-settlement-6.2.5, step 10
          // let settlementAccountsInit = Object.assign({}, settlementAccounts)

          // seq-settlement-6.2.5, step 10
          const participants = []
          const settlementParticipantCurrencyStateChange = []
          const processedAccounts = []

          // seq-settlement-6.2.5, step 11
          for (let participant in payload.participants) {
            const participantPayload = payload.participants[participant]
            participants.push({ id: participantPayload.id, accounts: [] })
            const pi = participants.length - 1
            participant = participants[pi]
            // seq-settlement-6.2.5, step 12
            for (const account in participantPayload.accounts) {
              const accountPayload = participantPayload.accounts[account]
              // seq-settlement-6.2.5, step 13
              if (allAccounts[accountPayload.id] === undefined) {
                participant.accounts.push({
                  id: accountPayload.id,
                  errorInformation: ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR, 'Account not found').toApiErrorObject().errorInformation
                })
                // seq-settlement-6.2.5, step 14
              } else if (participantPayload.id !== allAccounts[accountPayload.id].participantId) {
                processedAccounts.push(accountPayload.id)
                participant.accounts.push({
                  id: accountPayload.id,
                  errorInformation: ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR, 'Participant and account mismatch').toApiErrorObject().errorInformation
                })
                // seq-settlement-6.2.5, step 15
              } else if (processedAccounts.indexOf(accountPayload.id) > -1) {
                participant.accounts.push({
                  id: accountPayload.id,
                  state: allAccounts[accountPayload.id].state,
                  reason: allAccounts[accountPayload.id].reason,
                  createdDate: allAccounts[accountPayload.id].createdDate,
                  netSettlementAmount: allAccounts[accountPayload.id].netSettlementAmount,
                  errorInformation: ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR, 'Account already processed once').toApiErrorObject().errorInformation
                })
                // seq-settlement-6.2.5, step 16
              } else if (allAccounts[accountPayload.id].state === accountPayload.state) {
                processedAccounts.push(accountPayload.id)
                participant.accounts.push({
                  id: accountPayload.id,
                  state: accountPayload.state,
                  reason: accountPayload.reason,
                  externalReference: accountPayload.externalReference,
                  createdDate: transactionTimestamp,
                  netSettlementAmount: allAccounts[accountPayload.id].netSettlementAmount
                })
                settlementParticipantCurrencyStateChange.push({
                  settlementParticipantCurrencyId: allAccounts[accountPayload.id].key,
                  settlementStateId: accountPayload.state,
                  reason: accountPayload.reason,
                  externalReference: accountPayload.externalReference
                })
                allAccounts[accountPayload.id].reason = accountPayload.reason
                allAccounts[accountPayload.id].createdDate = transactionTimestamp
                // seq-settlement-6.2.5, step 17
              } else if ((settlementData.settlementStateId === enums.settlementStates.PENDING_SETTLEMENT && accountPayload.state === enums.settlementStates.PS_TRANSFERS_RECORDED) ||
                (settlementData.settlementStateId === enums.settlementStates.PS_TRANSFERS_RECORDED && accountPayload.state === enums.settlementStates.PS_TRANSFERS_RESERVED) ||
                (settlementData.settlementStateId === enums.settlementStates.PS_TRANSFERS_RESERVED && accountPayload.state === enums.settlementStates.PS_TRANSFERS_COMMITTED) ||
                ((settlementData.settlementStateId === enums.settlementStates.PS_TRANSFERS_COMMITTED || settlementData.settlementStateId === enums.settlementStates.SETTLING) &&
                  accountPayload.state === enums.settlementStates.SETTLED)) {
                processedAccounts.push(accountPayload.id)
                participant.accounts.push({
                  id: accountPayload.id,
                  state: accountPayload.state,
                  reason: accountPayload.reason,
                  externalReference: accountPayload.externalReference,
                  createdDate: transactionTimestamp,
                  netSettlementAmount: allAccounts[accountPayload.id].netSettlementAmount
                })
                const spcsc = {
                  settlementParticipantCurrencyId: allAccounts[accountPayload.id].key,
                  settlementStateId: accountPayload.state,
                  reason: accountPayload.reason,
                  externalReference: accountPayload.externalReference,
                  createdDate: transactionTimestamp
                }
                if (accountPayload.state === enums.settlementStates.PS_TRANSFERS_RECORDED) {
                  spcsc.settlementTransferId = generateULID()
                }
                settlementParticipantCurrencyStateChange.push(spcsc)

                if (accountPayload.state === enums.settlementStates.PS_TRANSFERS_RECORDED) {
                  settlementAccounts.pendingSettlementCount--
                  settlementAccounts.psTransfersRecordedCount++
                } else if (accountPayload.state === enums.settlementStates.PS_TRANSFERS_RESERVED) {
                  settlementAccounts.psTransfersRecordedCount--
                  settlementAccounts.psTransfersReservedCount++
                } else if (accountPayload.state === enums.settlementStates.PS_TRANSFERS_COMMITTED) {
                  settlementAccounts.psTransfersReservedCount--
                  settlementAccounts.psTransfersCommittedCount++
                } else /* if (accountPayload.state === enums.settlementStates.SETTLED) */ { // disabled as else path is never taken
                  settlementAccounts.psTransfersCommittedCount--
                  settlementAccounts.settledCount++
                  settlementAccounts.settledIdList.push(accountPayload.id)
                }
                settlementAccounts.changedIdList.push(accountPayload.id)
                allAccounts[accountPayload.id].state = accountPayload.state
                allAccounts[accountPayload.id].reason = accountPayload.reason
                allAccounts[accountPayload.id].externalReference = accountPayload.externalReference
                allAccounts[accountPayload.id].createdDate = transactionTimestamp
                // seq-settlement-6.2.5, step 18
              } else {
                participant.accounts.push({
                  id: accountPayload.id,
                  state: allAccounts[accountPayload.id].state,
                  reason: allAccounts[accountPayload.id].reason,
                  createdDate: allAccounts[accountPayload.id].createdDate,
                  netSettlementAmount: allAccounts[accountPayload.id].netSettlementAmount,
                  errorInformation: ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR, 'State change not allowed').toApiErrorObject().errorInformation
                })
              }
            }
          }
          let insertPromises = []
          let updatePromises = []
          // seq-settlement-6.2.5, step 19
          for (const spcsc of settlementParticipantCurrencyStateChange) {
            // Switched to insert from batchInsert because only LAST_INSERT_ID is returned
            // TODO:: PoC - batchInsert + select inserted ids vs multiple inserts without select
            const spcscCopy = Object.assign({}, spcsc)
            delete spcscCopy.settlementTransferId
            insertPromises.push(
              knex('settlementParticipantCurrencyStateChange')
                .insert(spcscCopy)
                .transacting(trx)
            )
          }
          const settlementParticipantCurrencyStateChangeIdList = (await Promise.all(insertPromises)).map(v => v[0])
          // seq-settlement-6.2.5, step 21
          for (const i in settlementParticipantCurrencyStateChangeIdList) {
            const updatedColumns = { currentStateChangeId: settlementParticipantCurrencyStateChangeIdList[i] }
            if (settlementParticipantCurrencyStateChange[i].settlementTransferId) {
              updatedColumns.settlementTransferId = settlementParticipantCurrencyStateChange[i].settlementTransferId
            }
            updatePromises.push(
              knex('settlementParticipantCurrency')
                .where('settlementParticipantCurrencyId', settlementParticipantCurrencyStateChange[i].settlementParticipantCurrencyId)
                .update(updatedColumns)
                .transacting(trx)
            )
          }
          await Promise.all(updatePromises)

          if (autoPositionReset) {
            if (settlementData.settlementStateId === enums.settlementStates.PENDING_SETTLEMENT) {
              await Facade.settlementTransfersPrepare(settlementId, transactionTimestamp, enums, trx)
            } else if (settlementData.settlementStateId === enums.settlementStates.PS_TRANSFERS_RECORDED) {
              await Facade.settlementTransfersReserve(settlementId, transactionTimestamp, requireLiquidityCheck, enums, trx)
            } else if (settlementData.settlementStateId === enums.settlementStates.PS_TRANSFERS_RESERVED) {
              await Facade.settlementTransfersCommit(settlementId, transactionTimestamp, enums, trx)
            }
          }

          // seq-settlement-6.2.5, step 23
          if (settlementAccounts.settledIdList.length > 0) {
            await knex('settlementContentAggregation').transacting(trx)
              .where('settlementId', settlementId)
              .whereIn('participantCurrencyId', settlementAccounts.settledIdList)
              .update('currentStateId', enums.settlementWindowStates.SETTLED)

            // check for settled content
            const scaContentToCheck = await knex('settlementContentAggregation').transacting(trx)
              .where('settlementId', settlementId)
              .whereIn('participantCurrencyId', settlementAccounts.settledIdList)
              .distinct('settlementWindowContentId')
            const contentIdCheckList = scaContentToCheck.map(v => v.settlementWindowContentId)
            const unsettledContent = await knex('settlementContentAggregation').transacting(trx)
              .whereIn('settlementWindowContentId', contentIdCheckList)
              .whereNot('currentStateId', enums.settlementWindowStates.SETTLED)
              .distinct('settlementWindowContentId')
            const unsettledContentIdList = unsettledContent.map(v => v.settlementWindowContentId)
            const settledContentIdList = arrayDiff(contentIdCheckList, unsettledContentIdList)

            // persist settled content
            insertPromises = []
            for (const settlementWindowContentId of settledContentIdList) {
              const swcsc = {
                settlementWindowContentId,
                settlementWindowStateId: enums.settlementWindowStates.SETTLED,
                reason: 'All content aggregation records are SETTLED'
              }
              insertPromises.push(
                knex('settlementWindowContentStateChange').transacting(trx)
                  .insert(swcsc)
              )
            }
            const settlementWindowContentStateChangeIdList = (await Promise.all(insertPromises)).map(v => v[0])
            updatePromises = []
            for (const i in settlementWindowContentStateChangeIdList) {
              const updatedColumns = { currentStateChangeId: settlementWindowContentStateChangeIdList[i] }
              updatePromises.push(
                knex('settlementWindowContent').transacting(trx)
                  .where('settlementWindowContentId', settledContentIdList[i])
                  .update(updatedColumns)
              )
            }
            await Promise.all(updatePromises)

            // check for settled windows
            const windowsToCheck = await knex('settlementWindowContent').transacting(trx)
              .whereIn('settlementWindowContentId', settledContentIdList)
              .distinct('settlementWindowId')
            const windowIdCheckList = windowsToCheck.map(v => v.settlementWindowId)
            const unsettledWindows = await knex('settlementWindowContent AS swc').transacting(trx)
              .join('settlementWindowContentStateChange AS swcsc', 'swcsc.settlementWindowContentStateChangeId', 'swc.currentStateChangeId')
              .whereIn('swc.settlementWindowId', windowIdCheckList)
              .whereNot('swcsc.settlementWindowStateId', enums.settlementWindowStates.SETTLED)
              .distinct('swc.settlementWindowId')
            const unsettledWindowIdList = unsettledWindows.map(v => v.settlementWindowId)
            const settledWindowIdList = arrayDiff(windowIdCheckList, unsettledWindowIdList)

            // persist settled windows
            insertPromises = []
            for (const settlementWindowId of settledWindowIdList) {
              const swsc = {
                settlementWindowId,
                settlementWindowStateId: enums.settlementWindowStates.SETTLED,
                reason: 'All settlement window content is SETTLED'
              }
              insertPromises.push(
                knex('settlementWindowStateChange').transacting(trx)
                  .insert(swsc)
              )
            }
            const settlementWindowStateChangeIdList = (await Promise.all(insertPromises)).map(v => v[0])
            updatePromises = []
            for (const i in settlementWindowStateChangeIdList) {
              const updatedColumns = { currentStateChangeId: settlementWindowStateChangeIdList[i] }
              updatePromises.push(
                knex('settlementWindow').transacting(trx)
                  .where('settlementWindowId', settledWindowIdList[i])
                  .update(updatedColumns)
              )
            }
            await Promise.all(updatePromises)
          }

          // seq-settlement-6.2.5, step 24
          const processedContent = await knex('settlementContentAggregation AS sca').transacting(trx)
            .join('settlementWindowContent AS swc', 'swc.settlementWindowContentId', 'sca.settlementWindowContentId')
            .join('settlementWindowContentStateChange AS swcsc', 'swcsc.settlementWindowContentStateChangeId', 'swc.currentStateChangeId')
            .join('ledgerAccountType AS lat', 'lat.ledgerAccountTypeId', 'swc.ledgerAccountTypeId')
            .join('settlementWindow AS sw', 'sw.settlementWindowId', 'swc.settlementWindowId')
            .join('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'sw.currentStateChangeId')
            .whereIn('sca.participantCurrencyId', settlementAccounts.changedIdList)
            .where('sca.settlementId', settlementId)
            .distinct(
              'sw.settlementWindowId',
              'swsc.settlementWindowStateId',
              'swsc.reason',
              'sw.createdDate AS createdDate1',
              'swsc.createdDate AS changedDate1',
              'swc.settlementWindowContentId',
              'swcsc.settlementWindowStateId AS state',
              'lat.name AS ledgerAccountType',
              'swc.currencyId',
              'swc.createdDate',
              'swcsc.createdDate AS changedDate'
            )
            .orderBy(['sw.settlementWindowId', 'swc.settlementWindowContentId'])
          const settlementWindows = groupByWindowsWithContent(processedContent)

          // seq-settlement-6.2.5, step post-26
          let settlementStateChanged = true
          if (settlementData.settlementStateId === enums.settlementStates.PENDING_SETTLEMENT &&
            settlementAccounts.pendingSettlementCount === 0) {
            settlementData.settlementStateId = enums.settlementStates.PS_TRANSFERS_RECORDED
            settlementData.reason = 'All settlement accounts are PS_TRANSFERS_RECORDED'
          } else if (settlementData.settlementStateId === enums.settlementStates.PS_TRANSFERS_RECORDED &&
            settlementAccounts.psTransfersRecordedCount === 0) {
            settlementData.settlementStateId = enums.settlementStates.PS_TRANSFERS_RESERVED
            settlementData.reason = 'All settlement accounts are PS_TRANSFERS_RESERVED'
          } else if (settlementData.settlementStateId === enums.settlementStates.PS_TRANSFERS_RESERVED &&
            settlementAccounts.psTransfersReservedCount === 0) {
            settlementData.settlementStateId = enums.settlementStates.PS_TRANSFERS_COMMITTED
            settlementData.reason = 'All settlement accounts are PS_TRANSFERS_COMMITTED'
          } else if (settlementData.settlementStateId === enums.settlementStates.PS_TRANSFERS_COMMITTED &&
            settlementAccounts.psTransfersCommittedCount > 0 &&
            settlementAccounts.settledCount > 0) {
            settlementData.settlementStateId = enums.settlementStates.SETTLING
            settlementData.reason = 'Some settlement accounts are SETTLED'
          } else if ((settlementData.settlementStateId === enums.settlementStates.PS_TRANSFERS_COMMITTED ||
            settlementData.settlementStateId === enums.settlementStates.SETTLING) &&
            settlementAccounts.psTransfersCommittedCount === 0) {
            settlementData.settlementStateId = enums.settlementStates.SETTLED
            settlementData.reason = 'All settlement accounts are SETTLED'
          } else {
            settlementStateChanged = false
          }

          // seq-settlement-6.2.5, step pre-27
          if (settlementStateChanged) {
            settlementData.createdDate = transactionTimestamp

            // seq-settlement-6.2.5, step 27
            const settlementStateChangeId = await knex('settlementStateChange')
              .insert(settlementData)
              .transacting(trx)
            // seq-settlement-6.2.5, step 29
            await knex('settlement')
              .where('settlementId', settlementData.settlementId)
              .update({ currentStateChangeId: settlementStateChangeId })
              .transacting(trx)
          }
          return {
            id: settlementId,
            state: settlementData.settlementStateId,
            createdDate: settlementData.createdDate,
            settlementWindows,
            participants
          }
        }
      } catch (err) {
        logger.error(err)
        throw ErrorHandler.Factory.reformatFSPIOPError(err)
      }
    })
  },

  abortById: async function (settlementId, payload, enums) {
    const knex = await Db.getKnex()
    return knex.transaction(async (trx) => {
      try {
        const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()

        // seq-settlement-6.2.6, step 8
        const settlementAccountList = await knex('settlementParticipantCurrency AS spc')
          .leftJoin('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'spc.currentStateChangeId')
          .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'spc.participantCurrencyId')
          .select('pc.participantId', 'spc.participantCurrencyId', 'spcsc.settlementStateId', 'spcsc.reason', 'spc.netAmount', 'pc.currencyId', 'spc.settlementParticipantCurrencyId AS key'
          )
          .where('spc.settlementId', settlementId)
          .transacting(trx)
          .forUpdate()

        // seq-settlement-6.2.6, step 10
        const windowsList = await knex('settlementSettlementWindow AS ssw')
          .join('settlementWindow AS sw', 'sw.settlementWindowId', 'ssw.settlementWindowId')
          .join('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'sw.currentStateChangeId')
          .select('sw.settlementWindowId', 'swsc.settlementWindowStateId', 'swsc.reason', 'sw.createdDate')
          .where('ssw.settlementId', settlementId)
          .transacting(trx)
          .forUpdate()

        let insertPromises = []
        let updatePromises = []
        // seq-settlement-6.2.6, step 12
        for (const sal of settlementAccountList) {
          // Switched to insert from batchInsert because only LAST_INSERT_ID is returned
          // TODO:: PoC - batchInsert + select inserted ids vs multiple inserts without select
          const spcsc = {
            settlementParticipantCurrencyId: sal.key,
            settlementStateId: enums.settlementStates.ABORTED,
            reason: payload.reason,
            externalReference: payload.externalReference
          }
          insertPromises.push(
            knex('settlementParticipantCurrencyStateChange')
              .insert(spcsc)
              .transacting(trx)
          )
        }
        const settlementParticipantCurrencyStateChangeIdList = (await Promise.all(insertPromises)).map(v => v[0])
        // seq-settlement-6.2.6, step 15
        for (const i in settlementParticipantCurrencyStateChangeIdList) {
          const updatedColumns = { currentStateChangeId: settlementParticipantCurrencyStateChangeIdList[i] }
          updatePromises.push(
            knex('settlementParticipantCurrency')
              .where('settlementParticipantCurrencyId', settlementAccountList[i].key)
              .update(updatedColumns)
              .transacting(trx)
          )
        }
        await Promise.all(updatePromises)

        await Facade.settlementTransfersAbort(settlementId, transactionTimestamp, enums, trx)

        // seq-settlement-6.2.6, step 16
        insertPromises = []
        for (const rec of windowsList) {
          const swsc = {
            settlementWindowId: rec.settlementWindowId,
            settlementWindowStateId: enums.settlementWindowStates.ABORTED,
            reason: payload.reason
          }
          insertPromises.push(
            knex('settlementWindowStateChange')
              .insert(swsc)
              .transacting(trx)
          )
        }
        const settlementWindowStateChangeIdList = (await Promise.all(insertPromises)).map(v => v[0])
        // seq-settlement-6.2.6, step 19
        updatePromises = []
        for (const i in settlementWindowStateChangeIdList) {
          updatePromises.push(
            knex('settlementWindow')
              .where('settlementWindowId', windowsList[i].settlementWindowId)
              .update({ currentStateChangeId: settlementWindowStateChangeIdList[i] })
              .transacting(trx)
          )
        }
        await Promise.all(updatePromises)

        // seq-settlement-6.2.6, step 20
        const settlementStateChangeId = await knex('settlementStateChange')
          .insert({
            settlementId,
            settlementStateId: enums.settlementStates.ABORTED,
            reason: payload.reason
          })
          .transacting(trx)
        // seq-settlement-6.2.6, step 22
        await knex('settlement')
          .where('settlementId', settlementId)
          .update({ currentStateChangeId: settlementStateChangeId })
          .transacting(trx)

        return {
          id: settlementId,
          state: payload.state,
          reason: payload.reason
        }
      } catch (err) {
        logger.error(err)
        throw ErrorHandler.Factory.reformatFSPIOPError(err)
      }
    })
  },

  getById: async function ({ settlementId }) {
    return Db.from('settlement').query(builder => {
      return builder
        .join('settlementStateChange AS ssc', 'ssc.settlementStateChangeId', 'settlement.currentStateChangeId')
        .select('settlement.settlementId',
          'settlement.settlementModelId',
          'ssc.settlementStateId AS state',
          'ssc.reason',
          'settlement.createdDate',
          'ssc.createdDate AS changedDate')
        .where('settlement.settlementId', settlementId)
        .first()
    })
  },

  getByParams: async function ({ state, fromDateTime, toDateTime, currency, settlementWindowId, fromSettlementWindowDateTime, toSettlementWindowDateTime, participantId, accountId }) {
    return Db.from('settlement').query(builder => {
      const b = builder
        .innerJoin('settlementStateChange AS ssc', 'ssc.settlementStateChangeId', 'settlement.currentStateChangeId')
        .innerJoin('settlementSettlementWindow AS ssw', 'ssw.settlementId', 'settlement.settlementId')
        .innerJoin('settlementWindow AS sw', 'sw.settlementWindowId', 'ssw.settlementWindowId')
        .innerJoin('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'sw.currentStateChangeId')
        .innerJoin('settlementContentAggregation AS sca', 'sca.settlementId', 'settlement.settlementId')
        .innerJoin('settlementParticipantCurrency AS spc', 'spc.settlementId', 'sca.settlementId')
        .innerJoin('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'spc.currentStateChangeId')
        .innerJoin('participantCurrency AS pc', 'pc.participantCurrencyId', 'spc.participantCurrencyId')
        .distinct('settlement.settlementId', 'ssc.settlementStateId', 'ssw.settlementWindowId',
          'swsc.settlementWindowStateId', 'swsc.reason AS settlementWindowReason', 'sw.createdDate',
          'swsc.createdDate AS changedDate', 'pc.participantId', 'spc.participantCurrencyId',
          'spcsc.reason AS accountReason', 'spcsc.settlementStateId AS accountState',
          'spc.netAmount AS accountAmount', 'pc.currencyId AS accountCurrency')
        .select()
      if (state) { b.where('ssc.settlementStateId', state) }
      if (fromDateTime) { b.where('settlement.createdDate', '>=', fromDateTime) }
      if (toDateTime) { b.where('settlement.createdDate', '<=', toDateTime) }
      if (currency) { b.where('pc.currencyId', currency) }
      if (settlementWindowId) { b.where('ssw.settlementWindowId', settlementWindowId) }
      if (fromSettlementWindowDateTime) { b.where('sw.createdDate', '>=', fromSettlementWindowDateTime) }
      if (toSettlementWindowDateTime) { b.where('sw.createdDate', '<=', toSettlementWindowDateTime) }
      if (participantId) { b.where('pc.participantId', participantId) }
      if (accountId) { b.where('spc.participantCurrencyId', accountId) }
      return b
    })
  },

  triggerSettlementEvent: async function ({ idList, reason }, settlementModel, enums = {}) {
    const knex = await Db.getKnex()
    // begin transaction
    return knex.transaction(async (trx) => {
      try {
        // insert new settlement
        const transactionTimestamp = new Date().toISOString().replace(/[TZ]/g, ' ').trim()
        let settlementId = await knex('settlement').transacting(trx)
          .insert({
            reason,
            createdDate: transactionTimestamp,
            settlementModelId: settlementModel.settlementModelId
          })
        settlementId = settlementId[0]
        const settlementSettlementWindowList = idList.map(settlementWindowId => {
          return {
            settlementId,
            settlementWindowId,
            createdDate: transactionTimestamp
          }
        })

        // associate settlement windows with the settlement
        await knex.batchInsert('settlementSettlementWindow', settlementSettlementWindowList).transacting(trx)

        // retrieve affected settlementWindowContent
        let swcList = await knex('settlementWindow AS sw').transacting(trx)
          .join('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'sw.currentStateChangeId')
          .join('settlementWindowContent AS swc', 'swc.settlementWindowId', 'sw.settlementWindowId')
          .join('settlementWindowContentStateChange AS swcsc', 'swcsc.settlementWindowContentStateChangeId', 'swc.currentStateChangeId')
          .whereRaw(`sw.settlementWindowId IN (${idList})`)
          .where('swc.ledgerAccountTypeId', settlementModel.ledgerAccountTypeId)
          .where('swc.currencyId', knex.raw('COALESCE(?, swc.currencyId)', settlementModel.currencyId))
          .whereIn('swsc.settlementWindowStateId', [enums.settlementWindowStates.CLOSED, enums.settlementWindowStates.ABORTED, enums.settlementWindowStates.PENDING_SETTLEMENT])
          .whereIn('swcsc.settlementWindowStateId', [enums.settlementWindowStates.CLOSED, enums.settlementWindowStates.ABORTED])

        if (settlementModel.currencyId === null) { // Default settlement model
          const allSettlementModels = await SettlementModelModel.getAll()
          const settlementModelCurrenciesList = allSettlementModels.filter(record => record.currencyId !== null).map(record => record.currencyId)
          swcList = swcList.filter(swc => !settlementModelCurrenciesList.includes(swc.currencyId))
        }

        const swcIdArray = swcList.map(record => record.settlementWindowContentId)

        // bind requested settlementWindowContent and settlementContentAggregation records
        await knex('settlementWindowContent').transacting(trx)
          .whereIn('settlementWindowContentId', swcIdArray)
          .update({ settlementId })
        await knex('settlementContentAggregation').transacting(trx)
          .whereIn('settlementWindowContentId', swcIdArray)
          .update({ settlementId, currentStateId: enums.settlementWindowStates.PENDING_SETTLEMENT })

        // change settlementWindowContent records state
        const settlementWindowContentStateChangeList = swcIdArray.map(value => {
          return {
            settlementWindowContentId: value,
            settlementWindowStateId: enums.settlementStates.PENDING_SETTLEMENT,
            reason,
            createdDate: transactionTimestamp
          }
        })
        let insertPromises = []
        for (const swcsc of settlementWindowContentStateChangeList) {
          insertPromises.push(
            knex('settlementWindowContentStateChange').transacting(trx)
              .insert(swcsc)
          )
        }
        const settlementWindowContentStateChangeIdList = (await Promise.all(insertPromises)).map(v => v[0])
        let updatePromises = []
        for (let index = 0; index < swcIdArray.length; index++) {
          updatePromises.push(await knex('settlementWindowContent').transacting(trx)
            .where('settlementWindowContentId', swcIdArray[index])
            .update({ currentStateChangeId: settlementWindowContentStateChangeIdList[index] }))
        }
        await Promise.all(updatePromises)

        // aggregate and insert settlement net amounts
        const builder = knex
          .from(knex.raw('settlementParticipantCurrency (settlementId, participantCurrencyId, createdDate, netAmount)'))
          .insert(function () {
            this.from('settlementContentAggregation AS sca')
              .whereRaw('sca.settlementId = ?', settlementId)
              .groupBy('sca.settlementId', 'sca.participantCurrencyId')
              .select('sca.settlementId', 'sca.participantCurrencyId', knex.raw('? AS createdDate', transactionTimestamp))
              .sum('sca.amount AS netAmount')
          })
          .transacting(trx)
        await builder

        // change settlementParticipantCurrency records state
        const settlementParticipantCurrencyList = await knex('settlementParticipantCurrency').select('settlementParticipantCurrencyId').where('settlementId', settlementId).transacting(trx)
        const settlementParticipantCurrencyIdList = []
        const settlementParticipantCurrencyStateChangeList = settlementParticipantCurrencyList.map(value => {
          settlementParticipantCurrencyIdList.push(value.settlementParticipantCurrencyId)
          return {
            settlementParticipantCurrencyId: value.settlementParticipantCurrencyId,
            settlementStateId: enums.settlementStates.PENDING_SETTLEMENT,
            reason,
            createdDate: transactionTimestamp
          }
        })
        insertPromises = []
        for (const spcsc of settlementParticipantCurrencyStateChangeList) {
          insertPromises.push(
            knex('settlementParticipantCurrencyStateChange').transacting(trx)
              .insert(spcsc)
          )
        }
        const settlementParticipantCurrencyStateChangeIdList = (await Promise.all(insertPromises)).map(v => v[0])
        updatePromises = []
        for (const index in settlementParticipantCurrencyIdList) {
          updatePromises.push(knex('settlementParticipantCurrency').transacting(trx)
            .where('settlementParticipantCurrencyId', settlementParticipantCurrencyIdList[index])
            .update({ currentStateChangeId: settlementParticipantCurrencyStateChangeIdList[index] }))
        }
        await Promise.all(updatePromises)

        // set state of CLOSED and ABORTED windows to PENDING_SETTLEMENT, skip already in PENDING_SETTLEMENT state
        const windowsStateToBeUpdatedIdList = await knex('settlementWindow AS sw').transacting(trx)
          .join('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'sw.currentStateChangeId')
          .whereIn('sw.settlementWindowId', idList)
          .whereIn('swsc.settlementWindowStateId', [enums.settlementWindowStates.CLOSED, enums.settlementWindowStates.ABORTED])
          .select('sw.settlementWindowId')
        const settlementWindowStateChangeList = windowsStateToBeUpdatedIdList.map(record => {
          return {
            settlementWindowId: record.settlementWindowId,
            settlementWindowStateId: enums.settlementStates.PENDING_SETTLEMENT,
            reason,
            createdDate: transactionTimestamp
          }
        })
        insertPromises = []
        for (const swsc of settlementWindowStateChangeList) {
          insertPromises.push(
            knex('settlementWindowStateChange').transacting(trx)
              .insert(swsc)
          )
        }
        const settlementWindowStateChangeIdList = (await Promise.all(insertPromises)).map(v => v[0])
        updatePromises = []
        for (let index = 0; index < settlementWindowStateChangeList.length; index++) {
          updatePromises.push(await knex('settlementWindow').transacting(trx)
            .where('settlementWindowId', settlementWindowStateChangeList[index].settlementWindowId)
            .update({ currentStateChangeId: settlementWindowStateChangeIdList[index] }))
        }
        await Promise.all(updatePromises)

        // initiate settlement state to PENDING_SETTLEMENT
        const settlementStateChangeId = await knex('settlementStateChange').transacting(trx)
          .insert({
            settlementId,
            settlementStateId: enums.settlementStates.PENDING_SETTLEMENT,
            reason,
            createdDate: transactionTimestamp
          })
        await knex('settlement').transacting(trx)
          .where('settlementId', settlementId)
          .update({ currentStateChangeId: settlementStateChangeId })
        return settlementId
      } catch (err) {
        logger.error(err)
        throw ErrorHandler.Factory.reformatFSPIOPError(err)
      }
    })
  },

  settlementParticipantCurrency: {
    getByListOfIds: async function (listOfIds) {
      return Db.from('settlementParticipantCurrency').query(builder => {
        return builder
          .leftJoin('participantCurrency AS pc', 'pc.participantCurrencyId', 'settlementParticipantCurrency.participantCurrencyId')
          .leftJoin('participant as p', 'p.participantCurrencyId', 'pc.participantCurrencyId')
          .select(
            'settlementParticipantCurrency.netAmount as amount',
            'pc.currencyId as currency',
            'p.participantId as participant'
          )
          .whereIn('settlementWindow.settlementWindowId', listOfIds)
      })
    },

    getAccountsInSettlementByIds: async function ({ settlementId, participantId }) {
      return Db.from('settlementParticipantCurrency').query(builder => {
        return builder
          .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'settlementParticipantCurrency.participantCurrencyId')
          .select('settlementParticipantCurrencyId')
          .where({ settlementId })
          .andWhere('pc.participantId', participantId)
      })
    },

    getParticipantCurrencyBySettlementId: async function ({ settlementId }) {
      return Db.from('settlementParticipantCurrency').query(builder => {
        return builder
          .leftJoin('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'settlementParticipantCurrency.currentStateChangeId')
          .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'settlementParticipantCurrency.participantCurrencyId')
          .select(
            'pc.participantId AS id',
            'settlementParticipantCurrency.participantCurrencyId AS participantCurrencyId',
            'spcsc.settlementStateId AS state',
            'spcsc.reason AS reason',
            'settlementParticipantCurrency.netAmount AS netAmount',
            'pc.currencyId AS currency',
            'settlementParticipantCurrency.settlementParticipantCurrencyId AS key'
          )
          .where({ settlementId })
      })
    },

    getSettlementAccountById: async function (settlementParticipantCurrencyId) {
      return Db.from('settlementParticipantCurrency').query(builder => {
        return builder
          .join('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'settlementParticipantCurrency.currentStateChangeId')
          .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'settlementParticipantCurrency.participantCurrencyId')
          .select(
            'pc.participantId AS id',
            'settlementParticipantCurrency.participantCurrencyId',
            'spcsc.settlementStateId AS state',
            'spcsc.reason AS reason',
            'settlementParticipantCurrency.netAmount as netAmount',
            'pc.currencyId AS currency'
          )
          .where('settlementParticipantCurrency.settlementParticipantCurrencyId', settlementParticipantCurrencyId)
      })
    },

    getSettlementAccountsByListOfIds: async function (settlementParticipantCurrencyIdList) {
      return Db.from('settlementParticipantCurrency').query(builder => {
        return builder
          .join('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'settlementParticipantCurrency.currentStateChangeId')
          .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'settlementParticipantCurrency.participantCurrencyId')
          .select(
            'pc.participantId AS id',
            'settlementParticipantCurrency.participantCurrencyId',
            'spcsc.settlementStateId AS state',
            'spcsc.reason AS reason',
            'settlementParticipantCurrency.netAmount as netAmount',
            'pc.currencyId AS currency'
          )
          .whereIn('settlementParticipantCurrency.settlementParticipantCurrencyId', settlementParticipantCurrencyIdList)
      })
    }
  },
  settlementSettlementWindow: {
    getWindowsBySettlementIdAndAccountId: async function ({ settlementId, accountId }) {
      return Db.from('settlementSettlementWindow').query(builder => {
        return builder
          .join('settlementWindow', 'settlementWindow.settlementWindowId', 'settlementSettlementWindow.settlementWindowId')
          .join('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId')
          .join('settlementTransferParticipant AS stp', function () {
            this.on('stp.settlementWindowId', 'settlementWindow.settlementWindowId')
              .on('stp.participantCurrencyId', accountId)
          })
          .distinct(
            'settlementWindow.settlementWindowId as id',
            'swsc.settlementWindowStateId as state',
            'swsc.reason as reason',
            'settlementWindow.createdDate as createdDate',
            'swsc.createdDate as changedDate'
          )
          .select()
          .where('settlementSettlementWindow.settlementId', settlementId)
      })
    },

    getWindowsBySettlementIdAndParticipantId: async function ({ settlementId, participantId }, enums) {
      const participantAccountList = (await Db.from('participantCurrency').find({ participantId, ledgerAccountTypeId: enums.ledgerAccountTypes.POSITION })).map(record => record.participantCurrencyId)
      return Db.from('settlementSettlementWindow').query(builder => {
        return builder
          .join('settlementWindow', 'settlementWindow.settlementWindowId', 'settlementSettlementWindow.settlementWindowId')
          .join('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'settlementWindow.currentStateChangeId')
          .join('settlementTransferParticipant AS stp', async function () {
            this.on('stp.settlementWindowId', 'settlementWindow.settlementWindowId')
              .onIn('stp.participantCurrencyId', participantAccountList)
          })
          .distinct(
            'settlementWindow.settlementWindowId as id',
            'swsc.settlementWindowStateId as state',
            'swsc.reason as reason',
            'settlementWindow.createdDate as createdDate',
            'swsc.createdDate as changedDate'
          )
          .select()
          .where('settlementSettlementWindow.settlementId', settlementId)
      })
    }
  }
}

module.exports = Facade
