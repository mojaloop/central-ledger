'use strict'

const CatboxMemory = require('catbox-memory')
const Config = require('../lib/config')
const Enums = require('../lib/enum')

const ttl = 60 * 1000
let catboxMemoryClient = null

/*
  Each client should register its API during module load.
  This is to simplify file structure, so that at the same time:
  - cache.js can control the life-cycle of underlying data (e.g. init, destroy, refresh, enable/disable, ttl)
  - while leaving cached APIs and uncached APIs in their own namespaces (e.g. files or dirs)
*/
const cacheClients = {
  participant: {
    api: {
      getAllNoCache: null
    }
  }
}

const registerParticipantClient = (participantClient) => {
  cacheClients.participant.api = participantClient
}

const initCache = async function () {
  // Init catbox.
  // Note: The strange looking "module.exports.CatboxMemory" reference
  // simplifies the setup of tests.
  catboxMemoryClient = new module.exports.CatboxMemory({
    maxByteSize: Config.CACHE_CONFIG.MAX_BYTE_SIZE
  })
  catboxMemoryClient.start()

  // Preload data
  await _getAllEnums()
  await getParticipantsCached()
}

const destroyCache = function () {
  catboxMemoryClient.stop()
}

const _getAllEnums = async function () {
  const allEnums = {}
  for (const enumId of Enums.enumsIds) {
    allEnums[enumId] = await getEnums(enumId)
  }
  return allEnums
}

const getEnums = async (id) => {
  let enums = null
  if (id === 'all') {
    enums = await _getAllEnums()
  } else {
    const key = {
      segment: 'enums',
      id
    }
    const enumsFromCache = catboxMemoryClient.get(key)
    if (enumsFromCache === null) {
      enums = await Enums[id]()
      catboxMemoryClient.set(key, enums, ttl)
    } else {
      // unwrap from catbox structure
      enums = enumsFromCache.item
    }
  }
  return enums
}

const getParticipantsCached = async () => {
  const key = {
    segment: 'participants',
    id: 'all'
  }

  let cachedParticipants = catboxMemoryClient.get(key)
  if (!cachedParticipants) {
    const allParticipants = await cacheClients.participant.api.getAllNoCache()

    // build indexes (or indices?) - optimization for byId and byName access
    const indexById = {}
    const indexByName = {}

    allParticipants.forEach((oneParticipant) => {
      indexById[oneParticipant.participantId] = oneParticipant
      indexByName[oneParticipant.name] = oneParticipant
    })

    // build unified structure - indexes + data
    cachedParticipants = {
      indexById,
      indexByName,
      allParticipants
    }

    // store in cache
    catboxMemoryClient.set(key, cachedParticipants, ttl)
  } else {
    // unwrap from catbox structure
    cachedParticipants = cachedParticipants.item
  }
  return cachedParticipants
}

module.exports = {
  // Clients registration
  registerParticipantClient,

  // Init & destroy the cache
  initCache,
  destroyCache,

  // enums
  getEnums,

  // participants
  getParticipantsCached,

  // exposed for tests
  CatboxMemory
}
