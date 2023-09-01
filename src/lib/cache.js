'use strict'

const CatboxMemory = require('@hapi/catbox-memory')
const Config = require('../lib/config')

let enabled = true
let ttl
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
    if (enabled) {
      return catboxMemoryClient.get(key)
    }
    return null
  }

  set (key, value) {
    catboxMemoryClient.set(key, value, parseInt(ttl))
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
let cacheClients = {}

const registerCacheClient = (clientMeta) => {
  const newClient = new CacheClient(clientMeta)
  cacheClients[clientMeta.id] = newClient
  return newClient
}

const initCache = async function () {
  // Read config
  ttl = Config.CACHE_CONFIG.EXPIRES_IN_MS
  enabled = Config.CACHE_CONFIG.CACHE_ENABLED

  // Init catbox.
  catboxMemoryClient = new CatboxMemory.Engine({
    maxByteSize: Config.CACHE_CONFIG.MAX_BYTE_SIZE
  })
  catboxMemoryClient.start()

  for (const clientId in cacheClients) {
    const clientMeta = cacheClients[clientId].getMeta()
    await clientMeta.preloadCache()
  }
}

const destroyCache = async function () {
  catboxMemoryClient.stop()
  catboxMemoryClient = null
}

const dropClients = function () {
  cacheClients = {}
}

const isCacheEnabled = function () {
  return enabled
}

module.exports = {
  // Clients registration
  registerCacheClient,

  // Init & destroy the cache
  initCache,
  destroyCache,
  isCacheEnabled,

  // exposed for tests
  CatboxMemory,
  dropClients
}
