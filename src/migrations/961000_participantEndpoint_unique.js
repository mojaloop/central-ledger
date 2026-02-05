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

 - Kalin Krustev <kalin.krustev@infitx.com>
 --------------
 ******/

'use strict'

// this migration deletes duplicates and enables unique constraint on the columns participantId and endpointTypeId,
// so that deadlocks can be avoided during inserts against massively repeated inactive endpoints
exports.up = async function (knex) {
  // delete inactive, where active exists for same participantId and endpointId
  await knex('participantEndpoint').whereIn('participantEndpointId',
    knex.fromRaw(
      `(${knex('participantEndpoint').where('isActive', 0).whereIn(['participantId', 'endpointTypeId'],
        knex.select('participantId', 'endpointTypeId').from('participantEndpoint').where('isActive', 1)
      ).select('participantEndpointId')}) as temp`
    ).select('participantEndpointId')
  ).delete()

  // delete duplicates, leave row with max id
  await knex('participantEndpoint').where('participantEndpointId', '>', '0').whereNotIn('participantEndpointId',
    knex.fromRaw(
      `(${knex('participantEndpoint').max('participantEndpointId', { as: 'participantEndpointId' }).groupBy('participantId', 'endpointTypeId')}) as temp`
    ).select('participantEndpointId')
  ).delete()

  return knex.schema.table('participantEndpoint', (t) => {
    t.unique(['participantId', 'endpointTypeId'])
  })
}

exports.down = function (knex) {
  return knex.schema.table('participantEndpoint', (t) => {
    t.dropUnique(['participantId', 'endpointTypeId'])
  })
}
