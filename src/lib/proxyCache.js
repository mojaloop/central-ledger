'use strict'
const { createProxyCache } = require('@mojaloop/inter-scheme-proxy-cache-lib')
const Config = require('./config.js')
const ParticipantService = require('../../src/domain/participant')

let proxyCache

const connect = async () => {
  return getCache().connect()
}

const disconnect = async () => {
  return proxyCache?.isConnected && proxyCache.disconnect()
}

const getCache = () => {
  if (!proxyCache) {
    proxyCache = Object.freeze(createProxyCache(
      Config.PROXY_CACHE_CONFIG.type,
      Config.PROXY_CACHE_CONFIG.proxyConfig
    ))
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
  const debtorProxyId = await getCache().lookupProxyByDfspId(debtorDfspId)
  const creditorProxyId = await getCache().lookupProxyByDfspId(creditorDfspId)
  return debtorProxyId && creditorProxyId ? debtorProxyId === creditorProxyId : false
}

module.exports = {
  connect,
  disconnect,
  getCache,
  getFSPProxy,
  checkSameCreditorDebtorProxy
}
