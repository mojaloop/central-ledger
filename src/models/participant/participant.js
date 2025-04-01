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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const Db = require('../../lib/db')
const rethrow = require('../../shared/rethrow')

exports.getAll = async () => {
  try {
    const result = await Db.from('participant').find({}, { order: 'name asc' })
    return result
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

exports.create = async (participant) => {
  try {
    const result = await Db.from('participant').insert({
      name: participant.name,
      createdBy: 'unknown',
      isProxy: !!participant.isProxy
    })
    return result
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

exports.update = async (participant, isActive) => {
  try {
    const result = await Db.from('participant').update({ participantId: participant.participantId }, { isActive })
    return result
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

exports.destroyByName = async (name) => {
  try {
    const result = await Db.from('participant').destroy({ name })
    return result
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}

exports.destroyParticipantEndpointByParticipantId = async (participantId) => {
  try {
    const result = Db.from('participantEndpoint').destroy({ participantId })
    return result
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}
