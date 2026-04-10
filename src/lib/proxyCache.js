/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Infitx
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 - Kevin Leyow <kevin.leyow@infitx.com>
 - Kalin Krustev <kalin.krustev@infitx.com>
 - Steven Oderayi <steven.oderayi@infitx.com>
 - Eugen Klymniuk <eugen.klymniuk@infitx.com>

 --------------

 ******/

'use strict'
const { createProxyCache } = require('@mojaloop/inter-scheme-proxy-cache-lib')
const { Enum } = require('@mojaloop/central-services-shared')
const ParticipantService = require('../../src/domain/participant')
const Config = require('./config')
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
 * @typedef {Object} ProxyOrParticipant - An object containing the inScheme status, proxyId and FSP name
 *
 * @property {boolean} inScheme - Is FSP in the scheme.
 * @property {string|null} proxyId - Proxy, associated with the FSP, if FSP is not in the scheme.
 * @property {string} name - FSP name.
 */

/**
 * Checks if dfspId is in scheme or proxy.
 *
 * @param {string} dfspId - The DFSP ID to check.
 * @param {Object} [options] - { validateCurrencyAccounts: boolean, accounts: [ { currency: string, accountType: Enum.Accounts.LedgerAccountType } ] }
 * @returns {ProxyOrParticipant} proxyOrParticipant details
 */
const getFSPProxy = async (dfspId, options = null) => {
  logger.debug('Checking if dfspId is in scheme or proxy', { dfspId })
  const participant = await ParticipantService.getByName(dfspId)
  let inScheme = !!participant

  if (inScheme && options?.validateCurrencyAccounts) {
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
    proxyId: !participant ? await getCache().lookupProxyByDfspId(dfspId) : null,
    name: dfspId
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
