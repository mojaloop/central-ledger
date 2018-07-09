'use strict'

const P = require('bluebird')
const Config = require('./config')

const participantRegex = new RegExp(`${Config.HOSTNAME}/participants/([A-Za-z0-9_]*)/?`, 'i')
const transfersRegex = new RegExp(`${Config.HOSTNAME}/transfers/([a-f\\d]{8}(-[a-f\\d]{4}){3}-[a-f\\d]{12})`, 'i')
const participantTransfersRouteRegex = new RegExp(/\/participants\/([A-Za-z0-9_]*)\/transfers/, 'i')

const nameFromParticipantUri = (uri, callback) => {
  const matches = uri.match(participantRegex)
  const hasCallback = (typeof callback === 'function')
  if (matches) {
    return (hasCallback) ? callback(null, matches[1]) : matches[1]
  } else {
    return (hasCallback) ? callback('no match', null) : null
  }
}

const participantNameFromTransfersRoute = (url) => {
  return new P((resolve, reject) => {
    const matches = url.match(participantTransfersRouteRegex)
    if (matches) {
      resolve(matches[1])
    } else {
      reject(new Error('No matching participant found in url'))
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
  const matches = id.match(transfersRegex)
  return (matches ? id : `${Config.HOSTNAME}/transfers/${id}`)
}

const toParticipantUri = (name) => {
  const matches = name.match(participantRegex)
  return (matches ? name : `${Config.HOSTNAME}/participants/${name}`)
}

module.exports = {
  participantNameFromTransfersRoute,
  nameFromParticipantUri,
  idFromTransferUri,
  toTransferUri,
  toParticipantUri
}
