/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/
'use strict'

/**
 * @module src/models/transfer/facade/
 */

const Db = require('../../lib/db')
const Enum = require('@mojaloop/central-services-shared').Enum
const Time = require('@mojaloop/central-services-shared').Util.Time
// const BulkTransferAssociation = require('./BulkTransferAssociation')
const rethrow = require('../../shared/rethrow')

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
      return state
    })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const saveBulkTransferProcessing = async (payload, stateReason = null, isValid = true) => {
  try {
    const bulkTransferFulfilmentRecord = {
      bulkTransferId: payload.bulkTransferId,
      completedDate: Time.getUTCString(new Date(payload.completedTimestamp))
    }
    // TODO: Remove count or decide on the strategy how to handle intdividual transfer results. Count is not sufficient criteria
    // because even if it's matched the transferId's may not match those on record.
    // const count = await BulkTransferAssociation.count(payload.bulkTransferId, Enum.Transfers.BulkProcessingState.ACCEPTED)
    const state = (isValid /* && payload.count === count */ ? Enum.Transfers.BulkTransferState.PROCESSING : Enum.Transfers.BulkTransferState.INVALID)
    const bulkTransferStateChangeRecord = {
      bulkTransferId: payload.bulkTransferId,
      bulkTransferStateId: state,
      reason: stateReason
    }

    const knex = await Db.getKnex()
    return await knex.transaction(async (trx) => {
      await knex('bulkTransferFulfilment').transacting(trx).insert(bulkTransferFulfilmentRecord)
      if (payload.extensionList && payload.extensionList.extension) {
        const bulkTransferExtensionsRecordList = payload.extensionList.extension.map(ext => {
          return {
            bulkTransferId: payload.bulkTransferId,
            isFulfilment: true,
            key: ext.key,
            value: ext.value
          }
        })
        await knex.batchInsert('bulkTransferExtension', bulkTransferExtensionsRecordList).transacting(trx)
      }
      await knex('bulkTransferStateChange').transacting(trx).insert(bulkTransferStateChangeRecord)
      return state
    })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const saveBulkTransferErrorProcessing = async (payload, stateReason = null, isValid = true) => {
  try {
    const bulkTransferFulfilmentRecord = {
      bulkTransferId: payload.bulkTransferId,
      completedDate: Time.getUTCString(new Date())
    }

    const state = (isValid ? Enum.Transfers.BulkTransferState.PROCESSING : Enum.Transfers.BulkTransferState.INVALID)
    const bulkTransferStateChangeRecord = {
      bulkTransferId: payload.bulkTransferId,
      bulkTransferStateId: state,
      reason: stateReason
    }

    const knex = await Db.getKnex()
    return await knex.transaction(async (trx) => {
      await knex('bulkTransferFulfilment').transacting(trx).insert(bulkTransferFulfilmentRecord)
      if (payload.errorInformation.extensionList && payload.errorInformation.extensionList.extension) {
        const bulkTransferExtensionsRecordList = payload.errorInformation.extensionList.extension.map(ext => {
          return {
            bulkTransferId: payload.bulkTransferId,
            isFulfilment: true,
            key: ext.key,
            value: ext.value
          }
        })
        await knex.batchInsert('bulkTransferExtension', bulkTransferExtensionsRecordList).transacting(trx)
      }
      const returnedInsertIds = await knex('bulkTransferStateChange').transacting(trx).insert(bulkTransferStateChangeRecord).returning('bulkTransferStateChangeId')
      const bulkTransferStateChangeId = returnedInsertIds[0]
      const bulkTransferErrorRecord = {
        bulkTransferStateChangeId,
        errorCode: payload.errorInformation.errorCode,
        errorDescription: payload.errorInformation.errorDescription
      }
      await knex('bulkTransferError').transacting(trx).insert(bulkTransferErrorRecord)
      return state
    })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const saveBulkTransferAborting = async (payload, stateReason = null) => {
  try {
    const bulkTransferFulfilmentRecord = {
      bulkTransferId: payload.bulkTransferId,
      completedDate: Time.getUTCString(new Date(payload.completedTimestamp))
    }

    const state = Enum.Transfers.BulkTransferState.ABORTING
    const bulkTransferStateChangeRecord = {
      bulkTransferId: payload.bulkTransferId,
      bulkTransferStateId: state,
      reason: stateReason
    }

    const knex = await Db.getKnex()
    return await knex.transaction(async (trx) => {
      await knex('bulkTransferFulfilment').transacting(trx).insert(bulkTransferFulfilmentRecord)
      if (payload.extensionList && payload.extensionList.extension) {
        const bulkTransferExtensionsRecordList = payload.extensionList.extension.map(ext => {
          return {
            bulkTransferId: payload.bulkTransferId,
            isFulfilment: true,
            key: ext.key,
            value: ext.value
          }
        })
        await knex.batchInsert('bulkTransferExtension', bulkTransferExtensionsRecordList).transacting(trx)
      }
      await knex('bulkTransferStateChange').transacting(trx).insert(bulkTransferStateChangeRecord)
      return state
    })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const TransferFacade = {
  saveBulkTransferReceived,
  saveBulkTransferProcessing,
  saveBulkTransferErrorProcessing,
  saveBulkTransferAborting
}

module.exports = TransferFacade
