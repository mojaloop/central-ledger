/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const P = require('bluebird')
const Config = require('./config')

const participantRegex = new RegExp(`${Config.HOSTNAME}/participants/([A-Za-z0-9_]*)/?`, 'i')
const transfersRegex = new RegExp(`${Config.HOSTNAME}/transfers/([a-f\\d]{8}(-[a-f\\d]{4}){3}-[a-f\\d]{12})`, 'i')
const participantTransfersRouteRegex = new RegExp(/\/participants\/([A-Za-z0-9_]*)\/transfers/, 'i')

const nameFromParticipantUri = (uri, done) => {
  const matches = uri.match(participantRegex)
  const hasCallback = (typeof done === 'function')
  if (matches) {
    return (hasCallback) ? done(null, matches[1]) : matches[1]
  } else {
    return (hasCallback) ? done('no match', null) : null
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

const idFromTransferUri = (uri, done) => {
  const matches = uri.match(transfersRegex)
  const hasCallback = (typeof done === 'function')
  if (matches) {
    return hasCallback ? done(null, matches[1]) : matches[1]
  } else {
    return hasCallback ? done('no match', null) : null
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
