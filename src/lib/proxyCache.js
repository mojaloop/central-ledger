'use strict'
const { createProxyCache, STORAGE_TYPES } = require('@mojaloop/inter-scheme-proxy-cache-lib')
const Config = require('./config.js')
const ParticipantService = require('../../src/domain/participant')

let proxyCache

const init = async () => {
  // enforce lazy connection for redis
  const proxyConfig =
    Config.PROXY_CACHE_CONFIG.type === STORAGE_TYPES.redis
      ? { ...Config.PROXY_CACHE_CONFIG.proxyConfig, lazyConnect: true }
      : Config.PROXY_CACHE_CONFIG.proxyConfig

  proxyCache = Object.freeze(
    createProxyCache(Config.PROXY_CACHE_CONFIG.type, proxyConfig)
  )
}

const connect = async () => {
  return !proxyCache?.isConnected && getCache().connect()
}

const disconnect = async () => {
  return proxyCache?.isConnected && proxyCache.disconnect()
}

const getCache = () => {
  if (!proxyCache) {
    init()
  }
  return proxyCache
}

const getFSPProxy = async (dfspId) => {
  const participant = await ParticipantService.getByName(dfspId)
  return {
    inScheme: !!participant,
    proxyId: !participant ? await getCache().lookupProxyByDfspId(dfspId) : null
  }
}

const checkSameCreditorDebtorProxy = async (debtorDfspId, creditorDfspId) => {
  const [debtorProxyId, creditorProxyId] = await Promise.all([
    await getCache().lookupProxyByDfspId(debtorDfspId),
    await getCache().lookupProxyByDfspId(creditorDfspId)
  ])
  return debtorProxyId && creditorProxyId ? debtorProxyId === creditorProxyId : false
}

module.exports = {
  connect,
  disconnect,
  getCache,
  getFSPProxy,
  checkSameCreditorDebtorProxy
}
