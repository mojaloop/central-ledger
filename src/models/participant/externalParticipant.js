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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Db = require('../../lib/db')
const { logger } = require('../../shared/logger')
const { TABLE_NAMES } = require('../../shared/constants')

const TABLE = TABLE_NAMES.externalParticipant
const ID_FIELD = 'externalParticipantId'

const log = logger.child(`DB#${TABLE}`)

// todo: use caching lib
const CACHE = {}
const cache = {
  get (key) {
    return CACHE[key]
  },
  set (key, value) {
    CACHE[key] = value
  }
}

const create = async ({ name, proxyId }) => {
  try {
    const result = await Db.from(TABLE).insert({ name, proxyId })
    log.debug('create result:', { result })
    return result
  } catch (err) {
    log.error('error in create', err)
    // If the cache is not up-to-date, then will get an error when inserting a record and that record already exists
    // reload the cache at that point.
    // todo: to implement above requirement, we need to detect duplication restriction error, and don't rethrow error
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

// const getAll = async (options = {}) => {
//   try {
//     const result = await Db.from(TABLE).find({}, options)
//     log.debug('getAll result:', { result })
//     return result
//   } catch (err) {
//     log.error('error in getAll:', err)
//     throw ErrorHandler.Factory.reformatFSPIOPError(err)
//   }
// }

const getOneBy = async (criteria, options) => {
  try {
    const result = await Db.from(TABLE).findOne(criteria, options)
    log.debug('getOneBy result:', { criteria, result })
    return result
  } catch (err) {
    log.error('error in getOneBy:', err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
const getOneById = async (id, options) => getOneBy({ [ID_FIELD]: id }, options)
const getOneByName = async (name, options) => getOneBy({ name }, options)

const getOneByNameCached = async (name, options = {}) => {
  let data = cache.get(name)
  if (data) {
    log.debug('getOneByIdCached cache hit:', { name, data })
  } else {
    data = await getOneByName(name, options)
    cache.set(name, data)
    log.debug('getOneByIdCached cache updated:', { name, data })
  }
  return data
}

// const getIdByNameOrCreate = async ({ name, proxyId }) => {
//   try {
//     let dfsp = await getOneByNameCached(name)
//     if (!dfsp) {
//       const isCreated = await create({ name, proxyId })
//       // todo: - check if create returns id (to avoid getOneByNameCached call)
//       //       - if isCreated === false, re-load all external participants cache
//       dfsp = await getOneByNameCached(name)
//     }
//     const id = dfsp?.[ID_FIELD]
//     log.verbose('getIdByNameOrCreate result:', { id, name })
//     return id
//   } catch (err) {
//     log.child({ name, proxyId }).warn('error in getIdByNameOrCreate:', err)
//     return null
//     // todo: think, if we need to rethrow an error here?
//   }
// }

const destroyBy = async (criteria) => {
  try {
    const result = await Db.from(TABLE).destroy(criteria)
    log.debug('destroyBy result:', { criteria, result })
    return result
  } catch (err) {
    log.error('error in destroyBy', err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
const destroyById = async (id) => destroyBy({ [ID_FIELD]: id })
const destroyByName = async (name) => destroyBy({ name })

// todo: think, if we need update method
module.exports = {
  create,
  // getIdByNameOrCreate,
  getOneByNameCached,
  getOneByName,
  getOneById,
  destroyById,
  destroyByName
}
