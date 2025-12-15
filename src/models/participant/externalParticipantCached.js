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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

const cache = require('../../lib/cache')
const externalParticipantModel = require('./externalParticipant')
const rethrow = require('../../shared/rethrow')

let cacheClient
const epAllCacheKey = 'all'

const buildUnifiedCachedData = (allExternalParticipants) => {
  // build indexes  - optimization for byId and byName access
  const indexById = {}
  const indexByName = {}

  allExternalParticipants.forEach(({ createdDate, ...ep }) => {
    indexById[ep.externalParticipantId] = ep
    indexByName[ep.name] = ep
  })

  // build unified structure - indexes + data
  return {
    indexById,
    indexByName,
    allExternalParticipants
  }
}

const getExternalParticipantsCached = () => cacheClient.get(epAllCacheKey)

const generate = async function (key) {
  const allParticipants = await externalParticipantModel.getAll()
  return buildUnifiedCachedData(allParticipants)
}

/*
  Public API
*/
const initialize = () => {
  /* Register as cache client */
  cacheClient = cache.registerCacheClient({ id: 'externalParticipants', generate, preloadCache: getExternalParticipantsCached })
}

const invalidateCache = async () => {
  cacheClient.drop(epAllCacheKey)
}

const getById = async (id) => {
  try {
    const cachedParticipants = await getExternalParticipantsCached()
    return cachedParticipants.indexById[id]
  } catch (err) /* istanbul ignore next */ {
    rethrow.rethrowCachedDatabaseError(err)
  }
}

const getByName = async (name) => {
  try {
    const cachedParticipants = await getExternalParticipantsCached()
    return cachedParticipants.indexByName[name]
  } catch (err) /* istanbul ignore next */ {
    rethrow.rethrowCachedDatabaseError(err)
  }
}

const getAll = async () => {
  try {
    const cachedParticipants = await getExternalParticipantsCached()
    return cachedParticipants.allExternalParticipants
  } catch (err) /* istanbul ignore next */ {
    rethrow.rethrowCachedDatabaseError(err)
  }
}

const withInvalidate = (theFunctionName) => {
  return async (...args) => {
    try {
      const result = await externalParticipantModel[theFunctionName](...args)
      await invalidateCache()
      return result
    } catch (err) /* istanbul ignore next */ {
      rethrow.rethrowCachedDatabaseError(err)
    }
  }
}

const create = withInvalidate('create')
const destroyById = withInvalidate('destroyById')
const destroyByName = withInvalidate('destroyByName')

module.exports = {
  initialize,
  invalidateCache,

  getAll,
  getById,
  getByName,

  create,
  destroyById,
  destroyByName
}
