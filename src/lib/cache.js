'use strict'

const CatboxMemory = require('catbox-memory')
const Config = require('../lib/config')
const Enums = require('../lib/enum')

const ttl = 60 * 1000
let catboxMemoryClient = null

class CacheClient {
  constructor (meta) {
    this.meta = meta
  }

  getMeta () {
    return this.meta
  }

  createKey (id) {
    return {
      segment: this.meta.id,
      id
    }
  }

  get (key) {
    return catboxMemoryClient.get(key)
  }

  set (key, value) {
    catboxMemoryClient.set(key, value, ttl)
  }

  drop (key) {
    catboxMemoryClient.drop(key)
  }
}

/*
  Each client should register itself during module load.
  The client meta should be:
  {
    id [MANDATORY]
    preloadCache() [OPTIONAL]
      this will be called to preload data
  }
*/
const cacheClients = {}

const registerCacheClient = (clientMeta) => {
  const newClient = new CacheClient(clientMeta)
  cacheClients[clientMeta.id] = newClient
  return newClient
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

  for (const clientId in cacheClients) {
    const clientMeta = cacheClients[clientId].getMeta()
    await clientMeta.preloadCache()
  }
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

module.exports = {
  // Clients registration
  registerCacheClient,

  // Init & destroy the cache
  initCache,
  destroyCache,

  // enums
  getEnums,

  // exposed for tests
  CatboxMemory
}
