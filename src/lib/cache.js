'use strict'

const CatboxMemory = require('catbox-memory')
const Config = require('../lib/config')
const Enums = require('../lib/enum')

const ttl = 60 * 1000
let catboxMemoryClient = null

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
      enums = enumsFromCache.item
    }
  }
  return enums
}

module.exports = {
  // Init & destroy the cache
  initCache,
  destroyCache,

  // enums
  getEnums,

  // exposed for tests
  CatboxMemory
}
