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

 * Neal Donnan <neal.donnan@modusbox.com>
 --------------
 ******/

'use strict'

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Cache = require('../../lib/cache')
const SettlementModel = require('../../models/settlement/settlementModel')
const Metrics = require('@mojaloop/central-services-metrics')

let cacheClient
let settlementModelsAllCacheKey

/*
  Private API
*/

const buildUnifiedSettlementModelsData = (allSettlementModels) => {
  // build indexes (or indices?) - optimization for byId and byName access
  const indexById = {}
  const indexByName = {}
  const indexByLedgerAccountTypeId = {}

  allSettlementModels.forEach((oneSettlementModel) => {
    // Add to indexes
    indexById[oneSettlementModel.settlementModelId] = oneSettlementModel
    indexByName[oneSettlementModel.name] = oneSettlementModel
    indexByLedgerAccountTypeId[oneSettlementModel.ledgerAccountTypeId] = oneSettlementModel
  })

  // build unified structure - indexes + data
  const unifiedSettlementModels = {
    indexById,
    indexByName,
    indexByLedgerAccountTypeId,
    allSettlementModels
  }

  return unifiedSettlementModels
}

const getSettlementModelsCached = async () => {
  const histTimer = Metrics.getHistogram(
    'model_settlementModel',
    'model_getSettlementModelsCached - Metrics for settlementModel model',
    ['success', 'queryName', 'hit']
  ).startTimer()
  // Do we have valid settlement models list in the cache ?
  let cachedSettlementModels = cacheClient.get(settlementModelsAllCacheKey)
  if (!cachedSettlementModels) {
    // No settlement models in the cache, so fetch from participant API
    const allSettlementModels = await SettlementModel.getAll()
    cachedSettlementModels = buildUnifiedSettlementModelsData(allSettlementModels)

    // store in cache
    cacheClient.set(settlementModelsAllCacheKey, cachedSettlementModels)
    histTimer({ success: true, queryName: 'model_getSettlementModelsCached', hit: false })
  } else {
    // unwrap settlement models list from catbox structure
    cachedSettlementModels = cachedSettlementModels.item
    histTimer({ success: true, queryName: 'model_getSettlementModelsCached', hit: true })
  }
  return cachedSettlementModels
}

/*
  Public API
*/
exports.initialize = async () => {
  /* Register as cache client */
  const settlementModelCacheClientMeta = {
    id: 'settlementModels',
    preloadCache: getSettlementModelsCached
  }

  cacheClient = Cache.registerCacheClient(settlementModelCacheClientMeta)
  settlementModelsAllCacheKey = cacheClient.createKey('all')
}

exports.invalidateSettlementModelsCache = async () => {
  cacheClient.drop(settlementModelsAllCacheKey)
}

exports.getById = async (id) => {
  try {
    const cachedSettlementModels = await getSettlementModelsCached()
    return cachedSettlementModels.indexById[id]
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.getByName = async (name) => {
  try {
    const cachedSettlementModels = await getSettlementModelsCached()
    return cachedSettlementModels.indexByName[name]
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.getByLedgerAccountTypeId = async (ledgerAccountTypeId) => {
  try {
    const cachedSettlementModels = await getSettlementModelsCached()
    return cachedSettlementModels.indexByLedgerAccountTypeId[ledgerAccountTypeId]
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.getAll = async () => {
  try {
    const cachedSettlementModels = await getSettlementModelsCached()
    return cachedSettlementModels.allSettlementModels
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
