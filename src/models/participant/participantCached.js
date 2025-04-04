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

 * Roman Pietrzak <roman.pietrzak@modusbox.com>
 --------------
 ******/

'use strict'

const Cache = require('../../lib/cache')
const ParticipantModel = require('../../models/participant/participant')
const Metrics = require('@mojaloop/central-services-metrics')
const rethrow = require('../../shared/rethrow')

let cacheClient
let participantsAllCacheKey

/*
  Private API
*/

const buildUnifiedParticipantsData = (allParticipants) => {
  // build indexes (or indices?) - optimization for byId and byName access
  const indexById = {}
  const indexByName = {}

  allParticipants.forEach((oneParticipant) => {
    // Participant API returns Date type, but cache internals will serialize it to String
    // by calling JSON.stringify(), which calls .toISOString() on a Date object.
    // Let's ensure all places return same kind of String.
    oneParticipant.createdDate = JSON.stringify(oneParticipant.createdDate)

    // Add to indexes
    indexById[oneParticipant.participantId] = oneParticipant
    indexByName[oneParticipant.name] = oneParticipant
  })

  // build unified structure - indexes + data
  const unifiedParticipants = {
    indexById,
    indexByName,
    allParticipants
  }

  return unifiedParticipants
}

const getParticipantsCached = async () => {
  const histTimer = Metrics.getHistogram(
    'model_participant',
    'model_getParticipantsCached - Metrics for participant model',
    ['success', 'queryName', 'hit']
  ).startTimer()
  // Do we have valid participants list in the cache ?
  let cachedParticipants = cacheClient.get(participantsAllCacheKey)
  if (!cachedParticipants) {
    // No participants in the cache, so fetch from participant API
    const allParticipants = await ParticipantModel.getAll()
    cachedParticipants = buildUnifiedParticipantsData(allParticipants)

    // store in cache
    cacheClient.set(participantsAllCacheKey, cachedParticipants)
    histTimer({ success: true, queryName: 'model_getParticipantsCached', hit: false })
  } else {
    // unwrap participants list from catbox structure
    cachedParticipants = cachedParticipants.item
    histTimer({ success: true, queryName: 'model_getParticipantsCached', hit: true })
  }
  return cachedParticipants
}

/*
  Public API
*/
exports.initialize = async () => {
  /* Register as cache client */
  const participantCacheClientMeta = {
    id: 'participants',
    preloadCache: getParticipantsCached
  }

  cacheClient = Cache.registerCacheClient(participantCacheClientMeta)
  participantsAllCacheKey = cacheClient.createKey('all')
}

exports.invalidateParticipantsCache = async () => {
  cacheClient.drop(participantsAllCacheKey)
}

exports.getById = async (id) => {
  try {
    const cachedParticipants = await getParticipantsCached()
    return cachedParticipants.indexById[id]
  } catch (err) {
    rethrow.rethrowCachedDatabaseError(err)
  }
}

exports.getByName = async (name) => {
  try {
    const cachedParticipants = await getParticipantsCached()
    return cachedParticipants.indexByName[name]
  } catch (err) {
    rethrow.rethrowCachedDatabaseError(err)
  }
}

exports.getAll = async () => {
  try {
    const cachedParticipants = await getParticipantsCached()
    return cachedParticipants.allParticipants
  } catch (err) {
    rethrow.rethrowCachedDatabaseError(err)
  }
}

const withInvalidate = (theFunctionName) => {
  return async (...args) => {
    try {
      const result = await ParticipantModel[theFunctionName](...args)
      await exports.invalidateParticipantsCache()
      return result
    } catch (err) {
      rethrow.rethrowCachedDatabaseError(err)
    }
  }
}

exports.create = withInvalidate('create')
exports.update = withInvalidate('update')
exports.destroyByName = withInvalidate('destroyByName')
exports.destroyParticipantEndpointByParticipantId = withInvalidate('destroyParticipantEndpointByParticipantId')
