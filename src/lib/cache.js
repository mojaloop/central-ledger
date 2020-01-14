'use strict'

const CatboxMemory = require('catbox-memory')
const Config = require('../lib/config')
const Enums = require('../lib/enumx')

const ttl = 60 * 1000
let catboxMemoryClient = null

const initCache = async function () {
  catboxMemoryClient = new CatboxMemory({
    maxByteSize: Config.CACHE_CONFIG.MAX_BYTE_SIZE
  })
  catboxMemoryClient.start()
}

const getEnums = async (id) => {
  const key = {
    segment: 'enums',
    id: 'id'
  }
  let enums = null
  const enumsFromCache = catboxMemoryClient.get(key)
  if (enumsFromCache === null) {
    console.log('enums cache miss')
    enums = await Enums[id]()
    catboxMemoryClient.set(key, enums, ttl)
  } else {
    console.log('enums cache hit')
    enums = enumsFromCache.item
  }
  return enums
}

module.exports = {
  initCache,
  getEnums
}
