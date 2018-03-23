'use strict'

const P = require('bluebird')
const Config = require('./config')

const uuidv4Regex = '([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})'
// const accountRegex = new RegExp(`${Config.HOSTNAME}/accounts/([A-Za-z0-9_]*)/?`, 'i')
const transfersValidationRegex = new RegExp(`${Config.HOSTNAME}/transfers/([a-f\\d]{8}(-[a-f\\d]{4}){3}-[a-f\\d]{12})`, 'i')
const accountRegex = new RegExp(`[^/]+(?=/$|$)`, 'i')
const transfersRegex = new RegExp(`${uuidv4Regex}`, 'i')
const accountsTransfersRouteRegex = new RegExp(/\/accounts\/([A-Za-z0-9_]*)\/transfers/, 'i')
const transferUUIDRegex = new RegExp(`${uuidv4Regex}`, 'i')

const uuidFromTransferUri = (uri, callback) => {
  const matches = uri.match(transferUUIDRegex)
  const hasCallback = (typeof callback === 'function')
  if (matches) {
    return (hasCallback) ? callback(null, matches[1]) : matches[1]
  } else {
    return (hasCallback) ? callback('no match', null) : null
  }
}

const nameFromAccountUri = (uri, callback) => {
  const matches = uri.match(accountRegex)
  const hasCallback = (typeof callback === 'function')
  if (matches) {
    return (hasCallback) ? callback(null, matches[0]) : matches[0]
  } else {
    return (hasCallback) ? callback('no match', null) : null
  }
}

const accountNameFromTransfersRoute = (url) => {
  return new P((resolve, reject) => {
    const matches = url.match(accountsTransfersRouteRegex)
    if (matches) {
      resolve(matches[1])
    } else {
      reject(new Error('No matching account found in url'))
    }
  })
}

const idFromTransferUri = (uri, callback) => {
  const matches = uri.match(transfersRegex)
  const hasCallback = (typeof callback === 'function')
  if (matches) {
    return hasCallback ? callback(null, matches[1]) : matches[1]
  } else {
    return hasCallback ? callback('no match', null) : null
  }
}

const toTransferUri = (id) => {
  const matches = id.match(transfersValidationRegex)
  return (matches ? id : `${Config.HOSTNAME}/transfers/${id}`)
}

const toAccountUri = (name) => {
  const matches = name.match(accountRegex)
  return (matches ? name : `${Config.HOSTNAME}/accounts/${name}`)
}

module.exports = {
  uuidFromTransferUri,
  accountNameFromTransfersRoute,
  nameFromAccountUri,
  idFromTransferUri,
  toTransferUri,
  toAccountUri
}
