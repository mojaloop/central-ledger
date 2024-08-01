'use strict'
const { createProxyCache, STORAGE_TYPES } = require('@mojaloop/inter-scheme-proxy-cache-lib')
const ParticipantService = require('../../src/domain/participant')
const Config = require('./config.js')

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
  proxyCache?.isConnected && await proxyCache.disconnect()
  proxyCache = null
}

const reset = async () => {
  await disconnect()
  proxyCache = null
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
  reset, // for testing
  connect,
  disconnect,
  getCache,
  getFSPProxy,
  checkSameCreditorDebtorProxy
}
