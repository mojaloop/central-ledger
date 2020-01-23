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

const participantsAllCacheKey = {
  segment: 'participants',
  id: 'all'
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

const destroyCache = async function () {
  catboxMemoryClient.stop()
  catboxMemoryClient = null
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
  let cachedParticipants = catboxMemoryClient.get(participantsAllCacheKey)
  if (!cachedParticipants) {
    // No participants in the cache, so fetch from participan API
    const allParticipants = await cacheClients.participant.api.getAllNoCache()
    cachedParticipants = buildUnifiedParticipantsData(allParticipants)

    // store in cache
    catboxMemoryClient.set(participantsAllCacheKey, cachedParticipants, ttl)
  } else {
    // unwrap participants list from catbox structure
    cachedParticipants = cachedParticipants.item
  }
  return cachedParticipants
}

const invalidateParticipantsCache = async () => {
  catboxMemoryClient.drop(participantsAllCacheKey)
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
  buildUnifiedParticipantsData,
  invalidateParticipantsCache,

  // exposed for tests
  CatboxMemory
}
