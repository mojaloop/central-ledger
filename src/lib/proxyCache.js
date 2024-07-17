'use strict'
const { createProxyCache } = require('@mojaloop/inter-scheme-proxy-cache-lib')
const Config = require('./config.js')
const ParticipantService = require('../../src/domain/participant')

const proxyCache = createProxyCache(
  Config.PROXY_CACHE_CONFIG.type,
  Config.PROXY_CACHE_CONFIG.proxyConfig
)

const getDebtorProxy = async (debtorDfspId) => {
  const participant = await ParticipantService.getByName(debtorDfspId)
  console.log(proxyCache)
  return {
    inScheme: !!participant,
    proxyId: !participant ? await proxyCache.lookupProxyByDfspId(debtorDfspId) : null
  }
}

const getCreditorProxy = async (creditorDfspId) => {
  const participant = await ParticipantService.getByName(creditorDfspId)
  return {
    inScheme: !!participant,
    proxyId: !participant ? await proxyCache.lookupProxyByDfspId(creditorDfspId) : null
  }
}

const checkSameCreditorDebtorProxy = async (debtorDfspId, creditorDfspId) => {
  const debtorProxyId = await proxyCache.lookupProxyByDfspId(debtorDfspId)
  const creditorProxyId = await proxyCache.lookupProxyByDfspId(creditorDfspId)
  return debtorProxyId === creditorProxyId
}

module.exports = {
  proxyCache,
  getDebtorProxy,
  getCreditorProxy,
  checkSameCreditorDebtorProxy
}
