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
const ParticipantLimitModel = require('../../models/participant/participantLimit')
const Metrics = require('@mojaloop/central-services-metrics')

let cacheClient
let participantLimitAllCacheKey

/*
  Private API
*/
const buildUnifiedParticipantsLimitData = (allLimitParticipants) => {
  // build indexes (or indices?) - optimization for byId and byName access
  const indexByParticipantCurrencyId = {}

  allLimitParticipants.forEach((oneLimitParticipant) => {
    // LimitParticipant API returns Date type, but cache internals will serialize it to String
    // by calling JSON.stringify(), which calls .toISOString() on a Date object.
    // Let's ensure all places return same kind of String.
    oneLimitParticipant.createdDate = JSON.stringify(oneLimitParticipant.createdDate)

    // Add to indexes
    indexByParticipantCurrencyId[oneLimitParticipant.participantCurrencyId] = oneLimitParticipant
  })

  // build unified structure - indexes + data
  const unifiedLimitParticipants = {
    indexByParticipantCurrencyId,
    allLimitParticipants
  }

  return unifiedLimitParticipants
}

const getParticipantLimitCached = async () => {
  const histTimer = Metrics.getHistogram(
    'model_participant',
    'model_getParticipantLimitCached - Metrics for participant model',
    ['success', 'queryName', 'hit']
  ).startTimer()
  // Do we have valid participantsLimit list in the cache ?
  let cachedLimitParticipants = cacheClient.get(participantLimitAllCacheKey)
  if (!cachedLimitParticipants) {
    // No participantsLimit in the cache, so fetch from participantsLimit API
    const allLimitParticipants = await ParticipantLimitModel.getAll()
    cachedLimitParticipants = buildUnifiedParticipantsLimitData(allLimitParticipants)

    // store in cache
    cacheClient.set(participantLimitAllCacheKey, cachedLimitParticipants)
    histTimer({ success: true, queryName: 'model_getParticipantLimitCached', hit: false })
  } else {
    // unwrap participants list from catbox structure
    cachedLimitParticipants = cachedLimitParticipants.item
    histTimer({ success: true, queryName: 'model_getParticipantLimitCached', hit: true })
  }
  return cachedLimitParticipants
}

/*
  Public API
*/
exports.initialize = async () => {
  /* Register as cache client */
  const participantLimitCacheClientMeta = {
    id: 'participantLimit',
    preloadCache: getParticipantLimitCached
  }

  cacheClient = Cache.registerCacheClient(participantLimitCacheClientMeta)
  participantLimitAllCacheKey = cacheClient.createKey('all')
}

exports.invalidateParticipantLimitCache = async () => {
  cacheClient.drop(participantLimitAllCacheKey)
}

exports.getByParticipantCurrencyId = async (id) => {
  const cachedLimitParticipants = await getParticipantLimitCached()
  const participantLimitById = cachedLimitParticipants.indexByParticipantCurrencyId[id]
  return participantLimitById
}

const withInvalidate = (theFunctionName) => {
  return async (...args) => {
    try {
      const result = await ParticipantLimitModel[theFunctionName](...args)
      await exports.invalidateParticipantLimitCache()
      return result
    } catch (err) {
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }
}

exports.insert = withInvalidate('insert')
exports.update = withInvalidate('update')
exports.destroyByParticipantCurrencyId = withInvalidate('destroyByParticipantCurrencyId')
exports.destroyByParticipantId = withInvalidate('destroyByParticipantId')
