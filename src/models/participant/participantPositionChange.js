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
 --------------
 ******/

'use strict'

/**
 * @module src/models/participant/
 */

const Db = require('../../lib/db')
const Metrics = require('@mojaloop/central-services-metrics')
const rethrow = require('../../shared/rethrow')

/**
 * @function getByParticipantPositionId
 *
 * @async
 * @description This returns the last participant position change for given participantPositionId
 *
 *
 * @param {integer} participantPositionId - the participant position id. Example: 1
 *
 * @returns {object} - Returns the row from participantPositionChange table if successful, or throws an error if failed
 */

const getByParticipantPositionId = async (participantPositionId) => {
  const histTimer = Metrics.getHistogram(
    'model_participant',
    'model_getByParticipantPositionId - Metrics for participant model',
    ['success', 'queryName', 'hit']
  ).startTimer()
  try {
    return await Db.from('participantPositionChange').query(async (builder) => {
      const result = builder
        .where({ 'participantPositionChange.participantPositionId': participantPositionId })
        .select('participantPositionChange.*')
        .orderBy('participantPositionChangeId', 'desc')
        .first()
      histTimer({ success: true, queryName: 'model_getByParticipantPositionId', hit: false })
      return result
    })
  } catch (err) {
    histTimer({ success: false, queryName: 'model_getByParticipantPositionId', hit: false })
    rethrow.rethrowDatabaseError(err)
  }
}
module.exports = {
  getByParticipantPositionId
}
