/**
 * Utility functions for HTTP header normalization and W3C baggage parsing.
 *
 * @module lib/headerUtils
 */
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
