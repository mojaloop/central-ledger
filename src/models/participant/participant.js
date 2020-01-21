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
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const Db = require('../../lib/db')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Cache = require('../../lib/cache')

/*
 Private API for Cache-only callbacks
 */
const participantCacheClient = {
  getAllNoCache: async () => {
    return Db.participant.find({}, { order: 'name asc' })
  }
}
Cache.registerParticipantClient(participantCacheClient)

/*
  Public API
*/
exports.getById = async (id) => {
  try {
    const cachedParticipants = await Cache.getParticipantsCached()
    return cachedParticipants.indexById[id]
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.getByName = async (name) => {
  try {
    const cachedParticipants = await Cache.getParticipantsCached()
    return cachedParticipants.indexByName[name]
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.getAll = async () => {
  try {
    const cachedParticipants = await Cache.getParticipantsCached()
    return cachedParticipants.allParticipants
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.create = async (participant) => {
  try {
    const result = await Db.participant.insert({
      name: participant.name,
      createdBy: 'unknown'
    })
    return result
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.update = async (participant, isActive) => {
  try {
    return await Db.participant.update({ participantId: participant.participantId }, { isActive })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.destroyByName = async (name) => {
  try {
    return await Db.participant.destroy({ name: name })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.destroyParticipantEndpointByParticipantId = async (participantId) => {
  try {
    return Db.participantEndpoint.destroy({ participantId: participantId })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
