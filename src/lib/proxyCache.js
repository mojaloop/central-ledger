'use strict'
const { createProxyCache } = require('@mojaloop/inter-scheme-proxy-cache-lib')
const { Enum } = require('@mojaloop/central-services-shared')
const ParticipantService = require('../../src/domain/participant')
const Config = require('./config.js')
const { logger } = require('../../src/shared/logger')

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

/**
 * Get the proxy details for the given dfspId
 *
 * @param {*} dfspId
 * @param {*} options - { validateCurrencyAccountsAreActive: boolean, accounts: [ { currency: string, accountType: Enum.Accounts.LedgerAccountType } ] }
 * @returns {Promise<{ inScheme: boolean, proxyId: string }>}
 */
const getFSPProxy = async (dfspId, options = null) => {
  logger.debug('Checking if dfspId is in scheme or proxy', { dfspId })
  const participant = await ParticipantService.getByName(dfspId)
  let inScheme = !!participant

  if (inScheme && options?.validateCurrencyAccountsAreActive) {
    logger.debug('Checking if participant currency accounts are active', { dfspId, options, participant })
    let accountsAreActive = false
    for (const account of options.accounts) {
      accountsAreActive = participant.currencyList.some((currAccount) => {
        return (
          currAccount.currencyId === account.currency &&
          currAccount.ledgerAccountTypeId === account.accountType &&
          currAccount.isActive === 1
        )
      })
      if (!accountsAreActive) break
    }
    inScheme = accountsAreActive
  }

  return {
    inScheme,
    proxyId: !participant ? await getCache().lookupProxyByDfspId(dfspId) : null
  }
}

const checkSameCreditorDebtorProxy = async (debtorDfspId, creditorDfspId) => {
  logger.debug('Checking if debtorDfspId and creditorDfspId are using the same proxy', { debtorDfspId, creditorDfspId })
  const [debtorProxyId, creditorProxyId] = await Promise.all([
    getCache().lookupProxyByDfspId(debtorDfspId),
    getCache().lookupProxyByDfspId(creditorDfspId)
  ])
  return debtorProxyId && creditorProxyId ? debtorProxyId === creditorProxyId : false
}

const getProxyParticipantAccountDetails = async (fspName, currency) => {
  logger.debug('Getting account details for fspName and currency', { fspName, currency })
  const proxyLookupResult = await getFSPProxy(fspName)
  if (proxyLookupResult.inScheme) {
    const participantCurrency = await ParticipantService.getAccountByNameAndCurrency(
      fspName,
      currency,
      Enum.Accounts.LedgerAccountType.POSITION
    )
    logger.debug("Account details for fspName's currency", { fspName, currency, participantCurrency })
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
      logger.debug('Account details for proxy\'s currency', { proxyId: proxyLookupResult.proxyId, currency, participantCurrency })
      return {
        inScheme: false,
        participantCurrencyId: participantCurrency?.participantCurrencyId || null
      }
    }
    logger.debug('No proxy found for fspName', { fspName })
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
