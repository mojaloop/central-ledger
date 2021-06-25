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

 * Roman Pietrzak <roman.pietrzak@modusbox.com>
 --------------
 ******/

'use strict'

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Cache = require('../../lib/cache')
const Config = require('../../../src/lib/config')
const ParticipantCurrencyModel = require('../../models/participant/participantCurrency')
const Metrics = require('@mojaloop/central-services-metrics')

let cacheClient
let participantCurrencyAllCacheKey

/*
  Private API
*/
const buildUnifiedParticipantsCurrencyData = (allCurrencyParticipants) => {
  // build indexes (or indices?) - optimization for byId and byName access
  const indexByParticipantCurrencyId = {}

  allCurrencyParticipants.forEach((oneCurrencyParticipant) => {
    // CurrencyParticipant API returns Date type, but cache internals will serialize it to String
    // by calling JSON.stringify(), which calls .toISOString() on a Date object.
    // Let's ensure all places return same kind of String.
    oneCurrencyParticipant.createdDate = JSON.stringify(oneCurrencyParticipant.createdDate)

    // Add to indexes
    indexByParticipantCurrencyId[oneCurrencyParticipant.participantCurrencyId] = oneCurrencyParticipant
  })

  // build unified structure - indexes + data
  const unifiedCurrencyParticipants = {
    indexByParticipantCurrencyId,
    allCurrencyParticipants
  }

  return unifiedCurrencyParticipants
}

const getParticipantCurrencyCached = async () => {
  const histTimer = Metrics.getHistogram(
    'model_participant',
    'model_getParticipantCurrencyCached - Metrics for participant model',
    ['success', 'queryName', 'hit']
  ).startTimer()
  // Do we have valid participantsCurrency list in the cache ?
  let cachedCurrencyParticipants = cacheClient.get(participantCurrencyAllCacheKey)
  if (!cachedCurrencyParticipants) {
    // No participantsCurrency in the cache, so fetch from participantsCurrency API
    const allCurrencyParticipants = await ParticipantCurrencyModel.getAll()
    cachedCurrencyParticipants = buildUnifiedParticipantsCurrencyData(allCurrencyParticipants)

    // store in cache
    cacheClient.set(participantCurrencyAllCacheKey, cachedCurrencyParticipants)
    histTimer({ success: true, queryName: 'model_getParticipantCurrencyCached', hit: false })
  } else {
    // unwrap participants list from catbox structure
    cachedCurrencyParticipants = cachedCurrencyParticipants.item
    histTimer({ success: true, queryName: 'model_getParticipantCurrencyCached', hit: true })
  }
  return cachedCurrencyParticipants
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
  participantCurrencyAllCacheKey = cacheClient.createKey('all')
}

exports.invalidateParticipantCurrencyCache = async () => {
  if (cacheClient) {
    cacheClient.drop(participantCurrencyAllCacheKey)
  }
}

exports.getByParticipantId = async (id, ledgerAccountTypeId = null) => {
  const cachedParticipants = await getParticipantCurrencyCached()

  /* filter by:
    - matching participantId id
    - if ledgerAccountTypeId given, compare against it
  */
  const participantsById = cachedParticipants.allCurrencyParticipants.filter((participantCurrencyRow) => {
    return (participantCurrencyRow.participantId === id) &&
      ((!ledgerAccountTypeId) || (participantCurrencyRow.ledgerAccountTypeId === ledgerAccountTypeId))
  })

  return participantsById
}

exports.getById = async (id) => {
  const cachedParticipants = await getParticipantCurrencyCached()
  const participantById = cachedParticipants.indexByParticipantCurrencyId[id]
  return participantById
}

exports.findOneByParams = async (params) => {
  const cachedParticipants = await getParticipantCurrencyCached()

  const found = cachedParticipants.allCurrencyParticipants.find((participantCurrencyRow) => {
    let isMatch = true
    for (const oneParamName in params) {
      if (params[oneParamName] !== participantCurrencyRow[oneParamName]) {
        isMatch = false
        break
      }
    }

    return isMatch
  })
  return found
}

exports.hubAccountExists = async (currencyId, ledgerAccountTypeId) => {
  const params = {
    participantId: Config.HUB_ID,
    currencyId,
    ledgerAccountTypeId
  }

  const participantCurrency = await exports.findOneByParams(params)
  return !!participantCurrency
}

const withInvalidate = (theFunctionName) => {
  return async (...args) => {
    try {
      const result = await ParticipantCurrencyModel[theFunctionName](...args)
      await exports.invalidateParticipantCurrencyCache()
      return result
    } catch (err) {
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }
}

exports.create = withInvalidate('create')
exports.update = withInvalidate('update')
exports.destroyByParticipantId = withInvalidate('destroyByParticipantId')
