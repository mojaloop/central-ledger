'use strict'

const CatboxMemory = require('catbox-memory')
const Config = require('../lib/config')
const Enums = require('../lib/enum')
const Logger = require('@mojaloop/central-services-logger')

const ttl = 60 * 1000
let catboxMemoryClient = null

const initCache = async function () {
  // Init catbox
  catboxMemoryClient = new CatboxMemory({
    maxByteSize: Config.CACHE_CONFIG.MAX_BYTE_SIZE
  })
  catboxMemoryClient.start()

  // Preload data
  await _getAllEnums()
}

const _getAllEnums = async function () {
  try {
    const allEnums = {}
    for (let enumId of Enums.enumsIds) {
      allEnums[enumId] = await getEnums(enumId)
    }
    return allEnums
  } catch (err) {
    Logger.error(err)
    throw err
  }
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
  initCache,
  getEnums
}
