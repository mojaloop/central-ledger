'use strict'

const CatboxMemory = require('catbox-memory')
const Config = require('../lib/config')
const Enums = require('../lib/enum')

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
  let enums = catboxMemoryClient.get(key)
  if (enums === null) {
    enums = await Enums[id]()
    console.log('get')
    catboxMemoryClient.set(key, enums, ttl)
  } else {
    console.log('get CACHED')
  }
  return enums
}

module.exports = {
  initCache,
  getEnums
}
