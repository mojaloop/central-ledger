/*****
 * @file This registers all handlers for the central-ledger API
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

 * Lazola Lucas <lazola.lucas@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @module src/domain/transfer
 */

const _ = require('lodash')
const ParticipantService = require('../../domain/participant')
const TransferState = require('./state')
const TransfersModel = require('./models/transfer-read-model')
const ilpModel = require('../../models/ilp')
const extensionModel = require('../../models/extensions')
const transferStateChangeModel = require('./models/transferStateChanges')
const ExecuteTransfersModel = require('../../models/executed-transfers')
const SettledTransfersModel = require('../../models/settled-transfers')

/**
 * @function saveTransferPrepared
 *
 * @async
 * @description Save prepared transfers. Updates transferRecord, ilpRecord and transferStateRecord
 * @param {object} payload - transfer request payload
 * @param {object} stateReason - defaults to Null
 */
const saveTransferPrepared = async (payload, stateReason = null, hasPassedValidation = true) => {
  try {
    const participants = []
    const names = [payload.payeeFsp, payload.payerFsp]

    for (let name of names) {
      const participant = await ParticipantService.getByName(name)
      participants.push(participant)
    }

    const participantIds = await _.reduce(participants, (m, acct) => _.set(m, acct.name, acct.participantId), {})

    const transferRecord = {
      transferId: payload.transferId,
      payeeParticipantId: participantIds[payload.payeeFsp],
      payerParticipantId: participantIds[payload.payerFsp],
      amount: payload.amount.amount,
      currencyId: payload.amount.currency,
      expirationDate: new Date(payload.expiration)
    }

    const ilpRecord = {
      transferId: payload.transferId,
      packet: payload.ilpPacket,
      condition: payload.condition,
      fulfilment: null
    }

    const state = ((hasPassedValidation) ? TransferState.RECEIVED : TransferState.ABORTED)

    const transferStateRecord = {
      transferId: payload.transferId,
      transferStateId: state,
      reason: stateReason,
      changedDate: new Date()
    }

    // TODO: Move inserts into a Transaction

    // first save transfer to make sure the foreign key integrity for ilp, transferStateChange and extensions
    await TransfersModel.saveTransfer(transferRecord)

    var extensionsRecordList = []

    if (payload.extensionList && payload.extensionList.extension) {
      extensionsRecordList = payload.extensionList.extension.map(ext => {
        return {
          transferId: payload.transferId,
          key: ext.key,
          value: ext.value,
          changedDate: new Date(),
          changedBy: 'user' // this needs to be changed and cannot be null
        }
      })
      for (let ext of extensionsRecordList) {
        await extensionModel.saveExtension(ext)
      }
    }

    await ilpModel.saveIlp(ilpRecord)

    await transferStateChangeModel.saveTransferStateChange(transferStateRecord)

    return {isSaveTransferPrepared: true, transferRecord, ilpRecord, transferStateRecord, extensionsRecordList}
  } catch (e) {
    throw e
  }
}

/**
 * @function saveTransferExecuted
 *
 * @async
 * @description Change transfer state to committed
 * @param {object} payload - transfer request payload
 * @param {timestamp} timestamp - current date time
 * @throw {general exception}
 */
const saveTransferExecuted = async ({payload, timestamp}) => {
  const fields = {
    state: TransferState.COMMITTED,
    fulfilment: payload.fulfilment,
    executedDate: new Date(timestamp)
  }
  return await TransfersModel.updateTransfer(payload.id, fields)
}

// This update should only be done if the transfer id only has the state RECEIVED //TODO
/**
 * @function updateTransferState
 *
 * @async
 * @description Change transfer state to committed
 * @param {object} payload - transfer request payload
 * @param {string} state - transfer state Id
 */
const updateTransferState = async (payload, state) => {
  const transferStateRecord = {
    transferId: payload.transferId,
    transferStateId: state,
    reason: '',
    changedDate: new Date()
  }
  return await transferStateChangeModel.saveTransferStateChange(transferStateRecord)
}

/**
 * @function saveTransferRejected
 *
 * @async
 * @description Change transfer state to aborted
 * @param {string} stateReason - transfer reject reason
 * @param {string} transferId - transfer request id
 * @throws {generalException}
 */
const saveTransferRejected = async (stateReason, transferId) => {
  try {
    const existingTransferStateChanges = await transferStateChangeModel.getByTransferId(transferId)

    let existingAbort = false
    let transferStateChange
    if (Array.isArray(existingTransferStateChanges)) {
      for (let transferState of existingTransferStateChanges) {
        if (transferState.transferStateId === TransferState.ABORTED) {
          existingAbort = true
          transferStateChange = transferState
          break
        }
      }
    } else {
      if (existingTransferStateChanges.transferStateId === TransferState.ABORTED) {
        existingAbort = true
        transferStateChange = existingTransferStateChanges
      }
    }
    if (!existingAbort) {
      transferStateChange = {}
      transferStateChange.transferStateChangeId = null
      transferStateChange.transferId = transferId
      transferStateChange.reason = stateReason
      transferStateChange.changedDate = new Date()
      transferStateChange.transferStateId = TransferState.ABORTED
      await transferStateChangeModel.saveTransferStateChange(transferStateChange)
      return {alreadyRejected: false, transferStateChange}
    } else {
      return {alreadyRejected: true, transferStateChange}
    }
  } catch (e) {
    throw e
  }
}

/**
 * @function saveExecutedTransfer
 *
 * @async
 * @description Creates an excuted transfer record and persist to the db
 */
const saveExecutedTransfer = async (transfer) => {
  await ExecuteTransfersModel.create(transfer.payload.id)
}

/**
 * @function saveSettledTransfers
 *
 * @async
 * @description Creates an settled transfer record and persist to the db
 */
const saveSettledTransfers = async ({id, settlement_id}) => {
  await SettledTransfersModel.create({id, settlement_id})
}

module.exports = {
  saveTransferPrepared,
  saveTransferExecuted,
  saveTransferRejected,
  saveExecutedTransfer,
  saveSettledTransfers,
  updateTransferState
}
