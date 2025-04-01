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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * @module src/models/participant/
 */

const Db = require('../../lib/db')
const ParticipantCurrencyModel = require('./participantCurrencyCached')
const rethrow = require('../../shared/rethrow')

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
    return Db.from('participantPosition').findOne({ participantCurrencyId })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
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
    return Db.from('participantPosition').destroy({ participantCurrencyId })
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
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
    rethrow.rethrowDatabaseError(err)
  }
}

const createParticipantPositionRecords = async (participantPositions, trx) => {
  try {
    const knex = Db.getKnex()
    const trxFunction = async (trx) => {
      try {
        await knex
          .batchInsert('participantPosition', participantPositions)
          .transacting(trx)
      } catch (err) {
        rethrow.rethrowDatabaseError(err)
      }
    }
    if (trx) {
      return trxFunction(trx)
    } else {
      return knex.transaction(trxFunction)
    }
  } catch (err) {
    rethrow.rethrowDatabaseError(err)
  }
}
module.exports = {
  createParticipantPositionRecords,
  getByParticipantCurrencyId,
  destroyByParticipantCurrencyId,
  destroyByParticipantId
}
