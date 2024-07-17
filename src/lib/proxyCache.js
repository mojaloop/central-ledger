'use strict'
const { createProxyCache } = require('@mojaloop/inter-scheme-proxy-cache-lib')
const Config = require('./config.js')
const ParticipantService = require('../../src/domain/participant')

const proxyCache = createProxyCache(
  Config.PROXY_CACHE_CONFIG.type,
  Config.PROXY_CACHE_CONFIG.proxyConfig
)

const getCache = () => {
  return proxyCache
}

const getFSPProxy = async (dfspId) => {
  const participant = await ParticipantService.getByName(dfspId)
  return {
    inScheme: !!participant,
    proxyId: !participant ? await proxyCache.lookupProxyByDfspId(dfspId) : null
  }
}

const checkSameCreditorDebtorProxy = async (debtorDfspId, creditorDfspId) => {
  const debtorProxyId = await proxyCache.lookupProxyByDfspId(debtorDfspId)
  const creditorProxyId = await proxyCache.lookupProxyByDfspId(creditorDfspId)
  return debtorProxyId === creditorProxyId
}

module.exports = {
  proxyCache,
  getCache,
  getFSPProxy,
  checkSameCreditorDebtorProxy
}
