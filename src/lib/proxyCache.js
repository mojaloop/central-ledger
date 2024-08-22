'use strict'
const { createProxyCache } = require('@mojaloop/inter-scheme-proxy-cache-lib')
const { Enum } = require('@mojaloop/central-services-shared')
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
    getCache().lookupProxyByDfspId(debtorDfspId),
    getCache().lookupProxyByDfspId(creditorDfspId)
  ])
  return debtorProxyId && creditorProxyId ? debtorProxyId === creditorProxyId : false
}

const getProxyParticipantAccountDetails = async (fspName, currency) => {
  const proxyLookupResult = await getFSPProxy(fspName)
  if (proxyLookupResult.inScheme) {
    const participantCurrency = await ParticipantService.getAccountByNameAndCurrency(
      fspName,
      currency,
      Enum.Accounts.LedgerAccountType.POSITION
    )
    return {
      inScheme: true,
      participantCurrencyId: participantCurrency?.participantCurrencyId || null
    }
  } else {
    if (proxyLookupResult.proxyId) {
      const participantCurrency = await ParticipantService.getAccountByNameAndCurrency(
        proxyLookupResult.proxyId,
        currency,
        Enum.Accounts.LedgerAccountType.POSITION
      )
      return {
        inScheme: false,
        participantCurrencyId: participantCurrency?.participantCurrencyId || null
      }
    }
    return {
      inScheme: false,
      participantCurrencyId: null
    }
  }
}

module.exports = {
  reset, // for testing
  connect,
  disconnect,
  getCache,
  getFSPProxy,
  getProxyParticipantAccountDetails,
  checkSameCreditorDebtorProxy
}
