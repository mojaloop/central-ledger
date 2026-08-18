'use strict'

const CatboxMemory = require('@hapi/catbox-memory')
const Catbox = require('@hapi/catbox')
const Config = require('./config')

const expiresIn = parseInt(Config.CACHE_CONFIG.EXPIRES_IN_MS)
// Init memory client
let catboxMemoryClient

class CacheClient {
  constructor (segment, generateFunc, preloadCache) {
    this.generateFunc = generateFunc
    this.segment = segment
    this.preloadCache = preloadCache
  }

  async initCache (catboxMemoryClient) {
    this.policy = new Catbox.Policy({
      generateFunc: this.generateFunc,
      expiresIn,
      generateTimeout: false
    }, catboxMemoryClient, this.segment)
    return await this.preloadCache?.()
  }

  get (key) {
    return this.policy ? this.policy.get(key) : this.generateFunc(key)
  }

  drop (key) {
    return this.policy?.drop(key)
  }
}

let cacheClients = {}

const registerCacheClient = ({ id, preloadCache, generate }) => {
  const newClient = new CacheClient(id, generate, preloadCache)
  cacheClients[id] = newClient
  return newClient
}

const initCache = async function () {
  if (isCacheEnabled()) {
    // Init catbox.
    catboxMemoryClient = new CatboxMemory.Engine({
      maxByteSize: Config.CACHE_CONFIG.MAX_BYTE_SIZE
    })
    await catboxMemoryClient.start()

    // Init each registered cache client
    for (const client of Object.values(cacheClients)) {
      await client.initCache(catboxMemoryClient)
    }
  } else {
    catboxMemoryClient = null
  }
}

const destroyCache = async function () {
  await catboxMemoryClient?.stop()
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
  CatboxMemory,
  dropClients
}
