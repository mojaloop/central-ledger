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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * @module src/models/participant/
 */

const Db = require('../../lib/db')
const ParticipantCurrencyModel = require('./participantCurrencyCached')
const Logger = require('@mojaloop/central-services-logger')

/**
 * @function GetByParticipantCurrencyId
 *
 * @async
 * @description This returns the participant position corresponding to the participantCurrencyId
 *
 *
 * @param {integer} participantCurrencyId - the participant currency id. Example: 1
 *
 * @returns {object} - Returns the row from participantPosition table if successful, or throws an error if failed
 */

const getByParticipantCurrencyId = async (participantCurrencyId) => {
  try {
    return Db.participantPosition.findOne({ participantCurrencyId })
  } catch (err) {
    Logger.error(err)
    throw err
  }
}

/**
 * @function DestroyByParticipantCurrencyId
 *
 * @async
 * @description This deletes the participant position corresponding to the participantCurrencyId
 *
 *
 * @param {integer} participantCurrencyId - the participant currency id. Example: 1
 *
 * @returns {integer} - Returns the number of rows deleted if successful, or throws an error if failed
 */

const destroyByParticipantCurrencyId = async (participantCurrencyId) => {
  try {
    return Db.participantPosition.destroy({ participantCurrencyId })
  } catch (err) {
    Logger.error(err)
    throw err
  }
}

/**
 * @function DestroyByParticipantId
 *
 * @async
 * @description This deletes the participant position corresponding to the participantCurrencyId
 *
 *
 * @param {integer} participantId - the participant currency id. Example: 1
 *
 * @returns {integer} - Returns the number of rows deleted if successful, or throws an error if failed
 */

const destroyByParticipantId = async (participantId) => {
  try {
    const knex = Db.getKnex()
    const participantCurrencyIdList = (await ParticipantCurrencyModel.getByParticipantId(participantId)).map(record => record.participantCurrencyId)
    return knex('participantPosition')
      .whereIn('participantCurrencyId', participantCurrencyIdList)
      .del()
  } catch (err) {
    Logger.error(err)
    throw err
  }
}

module.exports = {
  getByParticipantCurrencyId,
  destroyByParticipantCurrencyId,
  destroyByParticipantId
}

module.exports = require('../../lib/SeriesTool').mangleExports('ParticipantPosition', module.exports)
