'use strict'

const CatboxMemory = require('@hapi/catbox-memory')
const Catbox = require('@hapi/catbox')
const Config = require('../lib/config')

const expiresIn = parseInt(Config.CACHE_CONFIG.EXPIRES_IN_MS)
// Init memory client
const catboxMemoryClient = new CatboxMemory.Engine({ maxByteSize: Config.CACHE_CONFIG.MAX_BYTE_SIZE })
catboxMemoryClient.start()

class CacheClient {
  constructor (segment, generateFunc) {
    this.generateFunc = generateFunc
    if (Config.CACHE_CONFIG.CACHE_ENABLED) this.policy = new Catbox.Policy({ generateFunc, expiresIn, generateTimeout: false }, catboxMemoryClient, segment)
  }

  get (key) {
    return Config.CACHE_CONFIG.CACHE_ENABLED ? this.policy.get(key) : this.generateFunc(key)
  }

  drop (key) {
    return this.policy?.drop(key)
  }

  setGenerateFunc (generateFunc) {
    this.policy?.options({ generateFunc, expiresIn, generateTimeout: false })
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

const registerCacheClient = (id, generateFunc) => {
  const newClient = new CacheClient(id, generateFunc)
  cacheClients[id] = newClient
  return newClient
}

const initCache = async function () {
  // Read config
  for (const client of Object.values(cacheClients)) {
    await client.get('all') // preload cache
  }
}

const destroyCache = async function () {
  catboxMemoryClient.stop()
  catboxMemoryClient.start()
}

const dropClients = function () {
  cacheClients = {}
}

const isCacheEnabled = function () {
  return Config.CACHE_CONFIG.CACHE_ENABLED
}

module.exports = {
  // Clients registration
  registerCacheClient,

  // Init & destroy the cache
  initCache,
  destroyCache,
  isCacheEnabled,

  // exposed for tests
  Catbox,
  dropClients
}
