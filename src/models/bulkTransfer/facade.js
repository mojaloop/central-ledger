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
 --------------
 ******/
'use strict'

/**
 * @module src/models/transfer/facade/
 */

const Logger = require('@mojaloop/central-services-logger')
const Db = require('../../lib/db')
const Enum = require('@mojaloop/central-services-shared').Enum
const Time = require('@mojaloop/central-services-shared').Util.Time
// const BulkTransferAssociation = require('./BulkTransferAssociation')

const saveBulkTransferReceived = async (payload, participants, stateReason = null, isValid = true) => {
  try {
    const bulkTransferRecord = {
      bulkTransferId: payload.bulkTransferId,
      bulkQuoteId: payload.bulkQuoteId,
      payerParticipantId: participants.payerParticipantId,
      payeeParticipantId: participants.payeeParticipantId,
      expirationDate: Time.getUTCString(new Date(payload.expiration))
    }
    const state = (isValid ? Enum.Transfers.BulkTransferState.RECEIVED : Enum.Transfers.BulkTransferState.INVALID)
    const bulkTransferStateChangeRecord = {
      bulkTransferId: payload.bulkTransferId,
      bulkTransferStateId: state,
      reason: stateReason
    }

    const knex = await Db.getKnex()
    return await knex.transaction(async (trx) => {
      try {
        await knex('bulkTransfer').transacting(trx).insert(bulkTransferRecord)
        if (payload.extensionList && payload.extensionList.extension) {
          const bulkTransferExtensionsRecordList = payload.extensionList.extension.map(ext => {
            return {
              bulkTransferId: payload.bulkTransferId,
              key: ext.key,
              value: ext.value
            }
          })
          await knex.batchInsert('bulkTransferExtension', bulkTransferExtensionsRecordList).transacting(trx)
        }
        await knex('bulkTransferStateChange').transacting(trx).insert(bulkTransferStateChangeRecord)
        await trx.commit
        return state
      } catch (err) {
        await trx.rollback
        throw err
      }
    })
  } catch (err) {
    Logger.error(err)
    throw err
  }
}

const saveBulkTransferProcessing = async (payload, bulkTransferFulfilmentId, stateReason = null, isValid = true) => {
  try {
    const bulkTransferFulfilmentRecord = {
      bulkTransferFulfilmentId,
      bulkTransferId: payload.bulkTransferId,
      completedDate: Time.getUTCString(new Date(payload.completedTimestamp))
    }
    // TODO: Remove count or decide on the strategy how to handle intdividual transfer results. Count is not sufficient criteria
    // because even if it's matched the transferId's may not match those on record.
    // const count = await BulkTransferAssociation.count(payload.bulkTransferId, Enum.BulkProcessingState.ACCEPTED)
    const state = (isValid /* && payload.count === count */ ? Enum.Transfers.BulkTransferState.PROCESSING : Enum.Transfers.BulkTransferState.INVALID)
    const bulkTransferStateChangeRecord = {
      bulkTransferId: payload.bulkTransferId,
      bulkTransferStateId: state,
      reason: stateReason
    }

    const knex = await Db.getKnex()
    return await knex.transaction(async (trx) => {
      try {
        await knex('bulkTransferFulfilment').transacting(trx).insert(bulkTransferFulfilmentRecord)
        if (payload.extensionList && payload.extensionList.extension) {
          const bulkTransferExtensionsRecordList = payload.extensionList.extension.map(ext => {
            return {
              bulkTransferId: payload.bulkTransferId,
              bulkTransferFulfilmentId,
              key: ext.key,
              value: ext.value
            }
          })
          await knex.batchInsert('bulkTransferExtension', bulkTransferExtensionsRecordList).transacting(trx)
        }
        await knex('bulkTransferStateChange').transacting(trx).insert(bulkTransferStateChangeRecord)
        await trx.commit
        return state
      } catch (err) {
        await trx.rollback
        throw err
      }
    })
  } catch (err) {
    Logger.error(err)
    throw err
  }
}

const TransferFacade = {
  saveBulkTransferReceived,
  saveBulkTransferProcessing
}

module.exports = TransferFacade
