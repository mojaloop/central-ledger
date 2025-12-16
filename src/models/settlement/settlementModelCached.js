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

 * Neal Donnan <neal.donnan@modusbox.com>
 --------------
 ******/

'use strict'

const Cache = require('../../lib/cache')
const SettlementModel = require('../../models/settlement/settlementModel')
const rethrow = require('../../shared/rethrow')

let cacheClient
const settlementModelsAllCacheKey = 'all'

/*
  Private API
*/

const buildUnifiedSettlementModelsData = (allSettlementModels) => {
  // build indexes (or indices?) - optimization for byId and byName access
  const indexById = {}
  const indexByName = {}
  const indexByLedgerAccountTypeId = {}

  for (const oneSettlementModel of allSettlementModels) {
    // Add to indexes
    indexById[oneSettlementModel.settlementModelId] = oneSettlementModel
    indexByName[oneSettlementModel.name] = oneSettlementModel
    indexByLedgerAccountTypeId[oneSettlementModel.ledgerAccountTypeId] = oneSettlementModel
  }

  // build unified structure - indexes + data
  const unifiedSettlementModels = {
    indexById,
    indexByName,
    indexByLedgerAccountTypeId,
    allSettlementModels
  }

  return unifiedSettlementModels
}

const getSettlementModelsCached = () => cacheClient.get(settlementModelsAllCacheKey)

const generate = async function (key) {
  const allSettlementModels = await SettlementModel.getAll()
  return buildUnifiedSettlementModelsData(allSettlementModels)
}

/*
  Public API
*/
exports.initialize = async () => {
  /* Register as cache client */
  cacheClient = Cache.registerCacheClient({ id: 'settlementModels', generate, preloadCache: getSettlementModelsCached })
}

exports.invalidateSettlementModelsCache = async () => {
  cacheClient.drop(settlementModelsAllCacheKey)
}

exports.getById = async (id) => {
  try {
    const cachedSettlementModels = await getSettlementModelsCached()
    return cachedSettlementModels.indexById[id]
  } catch (err) {
    rethrow.rethrowCachedDatabaseError(err)
  }
}

exports.getByName = async (name) => {
  try {
    const cachedSettlementModels = await getSettlementModelsCached()
    return cachedSettlementModels.indexByName[name]
  } catch (err) {
    rethrow.rethrowCachedDatabaseError(err)
  }
}

exports.getByLedgerAccountTypeId = async (ledgerAccountTypeId) => {
  try {
    const cachedSettlementModels = await getSettlementModelsCached()
    return cachedSettlementModels.indexByLedgerAccountTypeId[ledgerAccountTypeId]
  } catch (err) {
    rethrow.rethrowCachedDatabaseError(err)
  }
}

exports.getAll = async () => {
  try {
    const cachedSettlementModels = await getSettlementModelsCached()
    return cachedSettlementModels.allSettlementModels
  } catch (err) {
    rethrow.rethrowCachedDatabaseError(err)
  }
}

exports.build = buildUnifiedSettlementModelsData
