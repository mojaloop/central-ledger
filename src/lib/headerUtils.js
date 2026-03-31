/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
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
 - Kevin Leyow <kevin.leyow@infitx.com>
 - Vijay <vijaya.guthi@infitx.com>
 --------------
 ******/
'use strict'

const Logger = require('../shared/logger').logger

/**
 * Retrieves a header value with case-insensitive key lookup and array coercion.
 * @param {Object} headers - incoming HTTP headers
 * @param {string} headerName - header name to look up
 * @returns {string|undefined}
 */
const getNormalizedHeaderValue = (headers, headerName) => {
  if (!headers || typeof headers !== 'object') {
    Logger.isDebugEnabled && Logger.debug(`getNormalizedHeaderValue: headers is invalid, headerName=${headerName}`)
    return undefined
  }
  const key = Object.keys(headers).find(k => k.toLowerCase() === headerName.toLowerCase())
  if (!key) {
    Logger.isDebugEnabled && Logger.debug(`getNormalizedHeaderValue: header not found, headerName=${headerName}`)
    return undefined
  }
  const value = headers[key]
  if (Array.isArray(value)) {
    const joinedValue = value.join(',')
    Logger.isDebugEnabled && Logger.debug(`getNormalizedHeaderValue: array value joined, key=${key}, result=${joinedValue}`)
    return joinedValue
  }
  if (value === null || value === undefined) {
    Logger.isDebugEnabled && Logger.debug(`getNormalizedHeaderValue: value is null/undefined, key=${key}`)
    return undefined
  }
  const strValue = String(value)
  Logger.isDebugEnabled && Logger.debug(`getNormalizedHeaderValue: returning value, key=${key}, value=${strValue}`)
  return strValue
}

/**
 * Parses a W3C baggage header value (comma-separated key=value pairs).
 * @param {string|string[]} baggage - raw baggage header value
 * @returns {Object} - key/value map
 */
const parseBaggageHeader = (baggage) => {
  if (!baggage) {
    Logger.isDebugEnabled && Logger.debug('parseBaggageHeader: baggage is empty')
    return {}
  }
  const baggageStr = Array.isArray(baggage) ? baggage.join(',') : String(baggage)
  if (!baggageStr) {
    Logger.isDebugEnabled && Logger.debug('parseBaggageHeader: baggageStr is empty after conversion')
    return {}
  }
  const result = Object.fromEntries(
    baggageStr.split(',')
      .map(entry => entry.trim().split('='))
      .filter(parts => parts.length >= 2)
      .map(([key, ...rest]) => [key.trim(), rest.join('=').trim()])
  )
  Logger.isDebugEnabled && Logger.debug(`parseBaggageHeader: parsed result=${JSON.stringify(result)}`)
  return result
}

/**
 * Returns true when the baggage header carries `test-instruction=skip-participant-cache`.
 * @param {Object} headers - incoming HTTP headers
 * @returns {boolean}
 */
const shouldSkipParticipantCache = (headers) => {
  const baggage = getNormalizedHeaderValue(headers, 'baggage')
  Logger.isDebugEnabled && Logger.debug(`shouldSkipParticipantCache: baggage=${baggage}`)
  if (!baggage) {
    Logger.isDebugEnabled && Logger.debug('shouldSkipParticipantCache: no baggage header found')
    return false
  }
  const parsed = parseBaggageHeader(baggage)
  const shouldSkip = parsed['test-instruction'] === 'skip-participant-cache'
  Logger.isDebugEnabled && Logger.debug(`shouldSkipParticipantCache: shouldSkip=${shouldSkip}, test-instruction=${parsed['test-instruction']}`)
  return shouldSkip
}

module.exports = {
  getNormalizedHeaderValue,
  parseBaggageHeader,
  shouldSkipParticipantCache
}
