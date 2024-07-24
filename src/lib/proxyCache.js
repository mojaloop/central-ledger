'use strict'
const { createProxyCache } = require('@mojaloop/inter-scheme-proxy-cache-lib')
const ParticipantService = require('../../src/domain/participant')
const Config = require('./config.js')

let proxyCache

const init = () => {
  const { type, proxyConfig } = Config.PROXY_CACHE_CONFIG
  proxyCache = createProxyCache(type, proxyConfig)
}

const connect = async () => {
  return !proxyCache?.isConnected && getCache().connect()
}

const disconnect = async () => {
  return proxyCache?.isConnected && proxyCache.disconnect()
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
    getCache().lookupProxyByDfspId(debtorDfspId),
    getCache().lookupProxyByDfspId(creditorDfspId)
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
