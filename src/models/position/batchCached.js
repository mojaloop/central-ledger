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
 - Kevin Leyow <kevin.leyow@infitx.com>

 --------------
 ******/

'use strict'

const Cache = require('../../lib/cache')
const Metrics = require('@mojaloop/central-services-metrics')
const BatchPositionModel = require('./batch')
const rethrow = require('../../shared/rethrow')

let cacheClient
let participantCurrencyAllCacheKey

/*
  Private API
*/

const buildUnifiedParticipantCurrencyData = (allParticipantCurrency) => {
  // build indexes (or indices?) - optimization for byId and byName access
  const indexById = {}
  const indexByParticipantId = {}

  for (const oneParticipantCurrency of allParticipantCurrency) {
    // Participant API returns Date type, but cache internals will serialize it to String
    // by calling JSON.stringify(), which calls .toISOString() on a Date object.
    // Let's ensure all places return same kind of String.
    oneParticipantCurrency.createdDate = JSON.stringify(oneParticipantCurrency.createdDate)

    // Add to indexes
    if (!(oneParticipantCurrency.participantId in indexByParticipantId)) {
      indexByParticipantId[oneParticipantCurrency.participantId] = []
    }
    indexByParticipantId[oneParticipantCurrency.participantId].push(oneParticipantCurrency)
    indexById[oneParticipantCurrency.participantCurrencyId] = oneParticipantCurrency
  }

  // build unified structure - indexes + data
  const unifiedParticipantsCurrency = {
    indexById,
    indexByParticipantId,
    allParticipantCurrency
  }
  return unifiedParticipantsCurrency
}

const getParticipantCurrencyCached = async (trx) => {
  const histTimer = Metrics.getHistogram(
    'model_participant_batch',
    'model_getParticipantsCached - Metrics for participant model',
    ['success', 'queryName', 'hit']
  ).startTimer()
  // Do we have valid participants list in the cache ?
  let cachedParticipantCurrency = cacheClient.get(participantCurrencyAllCacheKey)
  if (!cachedParticipantCurrency) {
    const allParticipantCurrency = await BatchPositionModel.getAllParticipantCurrency(trx)
    cachedParticipantCurrency = buildUnifiedParticipantCurrencyData(allParticipantCurrency)

    // store in cache
    cacheClient.set(participantCurrencyAllCacheKey, cachedParticipantCurrency)
    histTimer({ success: true, queryName: 'model_getParticipantCurrencyBatchCached', hit: false })
  } else {
    // unwrap participants list from catbox structure
    cachedParticipantCurrency = cachedParticipantCurrency.item
    histTimer({ success: true, queryName: 'model_getParticipantCurrencyBatchCached', hit: true })
  }
  return cachedParticipantCurrency
}

/*
  Public API
*/
exports.initialize = async () => {
  /* Register as cache client */
  const participantCurrencyCacheClientMeta = {
    id: 'participantCurrency',
    preloadCache: getParticipantCurrencyCached
  }

  cacheClient = Cache.registerCacheClient(participantCurrencyCacheClientMeta)
  participantCurrencyAllCacheKey = cacheClient.createKey('participantCurrency')
}

exports.getParticipantCurrencyByIds = async (trx, participantCurrencyIds) => {
  try {
    let participantCurrencies = []
    const cachedParticipantCurrency = await getParticipantCurrencyCached(trx)
    for (const participantCurrencyId of participantCurrencyIds) {
      participantCurrencies = participantCurrencies.concat(cachedParticipantCurrency.indexById[participantCurrencyId])
    }
    return participantCurrencies
  } catch (err) {
    rethrow.rethrowCachedDatabaseError(err)
  }
}

exports.getParticipantCurrencyByParticipantIds = async (trx, participantIds) => {
  try {
    let participantCurrencies = []
    const cachedParticipantCurrency = await getParticipantCurrencyCached(trx)
    for (const participantId of participantIds) {
      participantCurrencies = participantCurrencies.concat(cachedParticipantCurrency.indexByParticipantId[participantId])
    }
    return participantCurrencies
  } catch (err) {
    rethrow.rethrowCachedDatabaseError(err)
  }
}
