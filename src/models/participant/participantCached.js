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
const ParticipantModel = require('../../models/participant/participant')

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
  // Do we have valid participants list in the cache ?
  let cachedParticipants = cacheClient.get(participantsAllCacheKey)
  if (!cachedParticipants) {
    // No participants in the cache, so fetch from participant API
    const allParticipants = await ParticipantModel.getAll()
    cachedParticipants = buildUnifiedParticipantsData(allParticipants)

    // store in cache
    cacheClient.set(participantsAllCacheKey, cachedParticipants)
  } else {
    // unwrap participants list from catbox structure
    cachedParticipants = cachedParticipants.item
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
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.getByName = async (name) => {
  try {
    const cachedParticipants = await getParticipantsCached()
    return cachedParticipants.indexByName[name]
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.getAll = async () => {
  try {
    const cachedParticipants = await getParticipantsCached()
    return cachedParticipants.allParticipants
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const withInvalidate = (theFunctionName) => {
  return async (...args) => {
    try {
      const result = await ParticipantModel[theFunctionName](...args)
      await exports.invalidateParticipantsCache()
      return result
    } catch (err) {
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }
}

exports.create = withInvalidate('create')
exports.update = withInvalidate('update')
exports.destroyByName = withInvalidate('destroyByName')
exports.destroyParticipantEndpointByParticipantId = withInvalidate('destroyParticipantEndpointByParticipantId')
