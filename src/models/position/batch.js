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

 * INFITX
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>

 --------------
 ******/

'use strict'

const Db = require('../../lib/db')
const TransferExtensionModel = require('../transfer/transferExtension')
const { Enum } = require('@mojaloop/central-services-shared')
const rethrow = require('../../shared/rethrow')

const startDbTransaction = async () => {
  const knex = Db.getKnex()
  const trx = await knex.transaction()
  return trx
}

const getLatestTransferStateChangesByTransferIdList = async (trx, transfersIdList) => {
  const knex = Db.getKnex()
  try {
    const latestTransferStateChanges = {}
    const results = await knex('transferStateChange')
      .transacting(trx)
      .whereIn('transferStateChange.transferId', transfersIdList)
      .orderBy('transferStateChangeId', 'desc')
      .select('*')

    for (const result of results) {
      if (!latestTransferStateChanges[result.transferId]) {
        latestTransferStateChanges[result.transferId] = result
      }
    }
    return latestTransferStateChanges
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const getLatestFxTransferStateChangesByCommitRequestIdList = async (trx, commitRequestIdList) => {
  const knex = Db.getKnex()
  try {
    const latestFxTransferStateChanges = {}
    const results = await knex('fxTransferStateChange')
      .transacting(trx)
      .whereIn('fxTransferStateChange.commitRequestId', commitRequestIdList)
      .orderBy('fxTransferStateChangeId', 'desc')
      .select('*')

    for (const result of results) {
      if (!latestFxTransferStateChanges[result.commitRequestId]) {
        latestFxTransferStateChanges[result.commitRequestId] = result
      }
    }
    return latestFxTransferStateChanges
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const getAllParticipantCurrency = async (trx) => {
  const knex = Db.getKnex()
  if (trx) {
    const result = await knex('participantCurrency')
      .transacting(trx)
      .select('*')
    return result
  } else {
    const result = await knex('participantCurrency')
      .select('*')
    return result
  }
}

const getPositionsByAccountIdsForUpdate = async (trx, accountIds) => {
  const knex = Db.getKnex()
  const participantPositions = await knex('participantPosition')
    .transacting(trx)
    .whereIn('participantCurrencyId', accountIds)
    .forUpdate()
    .select('*')
  const positions = {}
  for (const position of participantPositions) {
    positions[position.participantCurrencyId] = position
  }
  return positions
}

const updateParticipantPosition = async (trx, participantPositionId, participantPositionValue, participantPositionReservedValue = null) => {
  const knex = Db.getKnex()
  const optionalValues = {}
  if (participantPositionReservedValue !== null) {
    optionalValues.reservedValue = participantPositionReservedValue
  }
  return await knex('participantPosition').transacting(trx)
    .where({ participantPositionId })
    .update({
      value: participantPositionValue,
      ...optionalValues,
      changedDate: new Date()
    })
}

const getTransferInfoList = async (trx, transferIds, transferParticipantRoleTypeId, ledgerEntryTypeId) => {
  try {
    const knex = Db.getKnex()
    const transferInfos = await knex('transferParticipant')
      .transacting(trx)
      .where({
        'transferParticipant.transferParticipantRoleTypeId': transferParticipantRoleTypeId,
        'transferParticipant.ledgerEntryTypeId': ledgerEntryTypeId
      })
      .whereIn('transferParticipant.transferId', transferIds)
      .select(
        'transferParticipant.*'
      )
    const info = {}
    // This should key the transfer info with the latest transferStateChangeId
    for (const transferInfo of transferInfos) {
      if (!(transferInfo.transferId in info)) {
        info[transferInfo.transferId] = transferInfo
      }
    }
    return info
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

const bulkInsertTransferStateChanges = async (trx, transferStateChangeList) => {
  const knex = Db.getKnex()
  return await knex.batchInsert('transferStateChange', transferStateChangeList).transacting(trx)
}

const bulkInsertFxTransferStateChanges = async (trx, fxTransferStateChangeList) => {
  const knex = Db.getKnex()
  return await knex.batchInsert('fxTransferStateChange', fxTransferStateChangeList).transacting(trx)
}

const bulkInsertParticipantPositionChanges = async (trx, participantPositionChangeList) => {
  const knex = Db.getKnex()
  return await knex.batchInsert('participantPositionChange', participantPositionChangeList).transacting(trx)
}

const getTransferByIdsForReserve = async (trx, transferIds) => {
  if (transferIds && transferIds.length > 0) {
    try {
      const knex = Db.getKnex()
      const query = await knex('transfer')
        .transacting(trx)
        .leftJoin('transferStateChange AS tsc', 'tsc.transferId', 'transfer.transferId')
        .leftJoin('transferState AS ts', 'ts.transferStateId', 'tsc.transferStateId')
        .leftJoin('transferFulfilment AS tf', 'tf.transferId', 'transfer.transferId')
        .leftJoin('transferError as te', 'te.transferId', 'transfer.transferId') // currently transferError.transferId is PK ensuring one error per transferId
        .whereIn('transfer.transferId', transferIds)
        .select(
          'transfer.*',
          'tsc.createdDate AS completedTimestamp',
          'ts.enumeration as transferStateEnumeration',
          'tf.ilpFulfilment AS fulfilment',
          'te.errorCode',
          'te.errorDescription'
        )
      const transfers = {}
      for (const transfer of query) {
        transfer.extensionList = await TransferExtensionModel.getByTransferId(transfer.transferId)
        if (transfer.errorCode && transfer.transferStateEnumeration === Enum.Transfers.TransferState.ABORTED) {
          if (!transfer.extensionList) transfer.extensionList = []
          transfer.extensionList.push({
            key: 'cause',
            value: `${transfer.errorCode}: ${transfer.errorDescription}`.substr(0, 128)
          })
        }
        transfer.isTransferReadModel = true
        transfers[transfer.transferId] = transfer
      }
      return transfers
    } catch (err) {
      rethrow.rethrowDatabaseError(err)
    }
  }
  return {}
}

const getFxTransferInfoList = async (trx, commitRequestId, transferParticipantRoleTypeId, ledgerEntryTypeId) => {
  try {
    const knex = Db.getKnex()
    const transferInfos = await knex('fxTransferParticipant')
      .transacting(trx)
      .where({
        'fxTransferParticipant.transferParticipantRoleTypeId': transferParticipantRoleTypeId,
        'fxTransferParticipant.ledgerEntryTypeId': ledgerEntryTypeId
      })
      .whereIn('fxTransferParticipant.commitRequestId', commitRequestId)
      .select(
        'fxTransferParticipant.*'
      )
    const info = {}
    // This should key the transfer info with the latest transferStateChangeId
    for (const transferInfo of transferInfos) {
      if (!(transferInfo.commitRequestId in info)) {
        info[transferInfo.commitRequestId] = transferInfo
      }
    }
    return info
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

// This model assumes that there is only one RESERVED participantPositionChange per commitRequestId and participantPositionId.
// If an fxTransfer use case changes in the future where more than one reservation happens to a participant's account
// for the same commitRequestId, this model will need to be updated.
const getReservedPositionChangesByCommitRequestIds = async (trx, commitRequestIdList) => {
  try {
    const knex = Db.getKnex()
    const participantPositionChanges = await knex('fxTransferStateChange')
      .transacting(trx)
      .whereIn('fxTransferStateChange.commitRequestId', commitRequestIdList)
      .where('fxTransferStateChange.transferStateId', Enum.Transfers.TransferInternalState.RESERVED)
      .leftJoin('participantPositionChange AS ppc', 'ppc.fxTransferStateChangeId', 'fxTransferStateChange.fxTransferStateChangeId')
      .select(
        'ppc.*',
        'fxTransferStateChange.commitRequestId AS commitRequestId'
      )
    const info = {}
    for (const participantPositionChange of participantPositionChanges) {
      if (!(participantPositionChange.commitRequestId in info)) {
        info[participantPositionChange.commitRequestId] = {}
      }
      if (participantPositionChange.participantCurrencyId) {
        info[participantPositionChange.commitRequestId][participantPositionChange.participantCurrencyId] = participantPositionChange
      }
    }
    return info
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

/**
 * Executes multiple Knex queries in a single database round-trip.
 * Requires { multipleStatements: true } in Knex connection config.
 */
async function executeMultiQuery (trx, queryBuilders) {
  // 1. Convert builders to SQL/Bindings
  const sqlObj = queryBuilders.map(qb => qb.toSQL().toNative())

  // 2. Join SQL with semicolons and flatten bindings
  const combinedSql = sqlObj.map(q => q.sql).join('; ')
  const combinedBindings = sqlObj.flatMap(q => q.bindings)

  // 3. Execute
  const [results] = await trx.raw(combinedSql, combinedBindings)

  // 4. Filter results (MySQL often adds a trailing header if the last query is an DML)
  // This ensures you only get the data sets for your specific queries
  return results.slice(0, queryBuilders.length)
}

const fetchAll = async (trx, transfersIdList, commitRequestIdList, accountIds, reservedActionTransferIdList) => {
  const knex = Db.getKnex()
  try {
    const [results, results1, /* participantPositions */, transferInfos, participantPositionChanges, query, extensions] = await executeMultiQuery(trx, [
      // Pre fetch latest transferStates for all the transferIds in the account-bin
      knex('transferStateChange')
        .transacting(trx)
        .whereIn('transferStateChange.transferId', transfersIdList)
        .orderBy('transferStateChangeId', 'desc')
        .select('*'),
      // Pre fetch latest fxTransferStates for all the commitRequestIds in the account-bin
      knex('fxTransferStateChange')
        .transacting(trx)
        .whereIn('fxTransferStateChange.commitRequestId', commitRequestIdList)
        .orderBy('fxTransferStateChangeId', 'desc')
        .select('*'),
      // TODO the query below can be re-added later, instead of the separate call to getPositionsByAccountIdsForUpdate below
      // Pre fetch all position account balances for the account-bin and acquire lock on position
      // knex('participantPosition')
      //   .transacting(trx)
      //   .whereIn('participantCurrencyId', accountIds)
      //   .forUpdate() // TODO this can be removed if we implement optimistic updates to the position. For now we are using pessimistic locking.
      //   .select('*'),
      knex('transferParticipant')
        .transacting(trx)
        .where({
          'transferParticipant.transferParticipantRoleTypeId': Enum.Accounts.TransferParticipantRoleType.PAYEE_DFSP,
          'transferParticipant.ledgerEntryTypeId': Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE
        })
        .whereIn('transferParticipant.transferId', transfersIdList)
        .select(
          'transferParticipant.*'
        ),
      // Fetch all RESERVED participantPositionChanges associated with a commitRequestId
      // These will contain the value that was reserved for the fxTransfer
      // We will use these values to revert the position on timeouts
      knex('fxTransferStateChange')
        .transacting(trx)
        .whereIn('fxTransferStateChange.commitRequestId', commitRequestIdList)
        .where('fxTransferStateChange.transferStateId', Enum.Transfers.TransferInternalState.RESERVED)
        .leftJoin('participantPositionChange AS ppc', 'ppc.fxTransferStateChangeId', 'fxTransferStateChange.fxTransferStateChangeId')
        .select(
          'ppc.*',
          'fxTransferStateChange.commitRequestId AS commitRequestId'
        ),
      // Pre fetch transfers for all reserve action fulfils
      reservedActionTransferIdList &&
      reservedActionTransferIdList.length > 0 &&
      knex('transfer')
        .transacting(trx)
        .leftJoin('transferStateChange AS tsc', 'tsc.transferId', 'transfer.transferId')
        .leftJoin('transferState AS ts', 'ts.transferStateId', 'tsc.transferStateId')
        .leftJoin('transferFulfilment AS tf', 'tf.transferId', 'transfer.transferId')
        .leftJoin('transferError as te', 'te.transferId', 'transfer.transferId') // currently transferError.transferId is PK ensuring one error per transferId
        .whereIn('transfer.transferId', reservedActionTransferIdList)
        .select(
          'transfer.*',
          'tsc.createdDate AS completedTimestamp',
          'ts.enumeration as transferStateEnumeration',
          'tf.ilpFulfilment AS fulfilment',
          'te.errorCode',
          'te.errorDescription'
        ),
      // Pre fetch transfer extensions for all reserve action fulfils
      reservedActionTransferIdList &&
      reservedActionTransferIdList.length > 0 &&
      knex('transfer')
        .transacting(trx)
        .from('transferExtension')
        .whereIn('transferId', reservedActionTransferIdList)
        .where('isFulfilment', false)
        .where('isError', false)
        .select('*')
    ].filter(Boolean))

    // ** //
    const latestTransferStateChanges = {}

    for (const result of results) {
      if (!latestTransferStateChanges[result.transferId]) {
        latestTransferStateChanges[result.transferId] = result
      }
    }
    const latestTransferStates = {}
    for (const key in latestTransferStateChanges) {
      latestTransferStates[key] = latestTransferStateChanges[key].transferStateId
    }
    // ** //
    const latestFxTransferStateChanges = {}

    for (const result of results1) {
      if (!latestFxTransferStateChanges[result.commitRequestId]) {
        latestFxTransferStateChanges[result.commitRequestId] = result
      }
    }
    const latestFxTransferStates = {}
    for (const key in latestFxTransferStateChanges) {
      latestFxTransferStates[key] = latestFxTransferStateChanges[key].transferStateId
    }
    // ** //
    // const positions = {}
    // for (const position of participantPositions) {
    //   positions[position.participantCurrencyId] = position
    // }
    // TODO this query can be removed later, instead of being a separate one
    const positions = await getPositionsByAccountIdsForUpdate(trx, accountIds)
    // ** //
    const info = {}
    // This should key the transfer info with the latest transferStateChangeId
    for (const transferInfo of transferInfos) {
      if (!(transferInfo.transferId in info)) {
        info[transferInfo.transferId] = transferInfo
      }
    }
    // ** //
    const info1 = {}
    for (const participantPositionChange of participantPositionChanges) {
      if (!(participantPositionChange.commitRequestId in info1)) {
        info1[participantPositionChange.commitRequestId] = {}
      }
      if (participantPositionChange.participantCurrencyId) {
        info1[participantPositionChange.commitRequestId][participantPositionChange.participantCurrencyId] = participantPositionChange
      }
    }
    // ** //
    const transfers = {}
    if (reservedActionTransferIdList && reservedActionTransferIdList.length > 0) {
      for (const transfer of query) {
        transfer.extensionList = extensions.filter(ext => ext.transferId === transfer.transferId)
        if (transfer.errorCode && transfer.transferStateEnumeration === Enum.Transfers.TransferState.ABORTED) {
          if (!transfer.extensionList) transfer.extensionList = []
          transfer.extensionList.push({
            key: 'cause',
            value: `${transfer.errorCode}: ${transfer.errorDescription}`.substr(0, 128)
          })
        }
        transfer.isTransferReadModel = true
        transfers[transfer.transferId] = transfer
      }
    }
    return [latestTransferStates, latestFxTransferStates, positions, info, info1, transfers]
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

module.exports = {
  fetchAll,
  startDbTransaction,
  getLatestTransferStateChangesByTransferIdList,
  getLatestFxTransferStateChangesByCommitRequestIdList,
  getPositionsByAccountIdsForUpdate,
  updateParticipantPosition,
  bulkInsertTransferStateChanges,
  bulkInsertFxTransferStateChanges,
  bulkInsertParticipantPositionChanges,
  getAllParticipantCurrency,
  getTransferInfoList,
  getTransferByIdsForReserve,
  getFxTransferInfoList,
  getReservedPositionChangesByCommitRequestIds
}
