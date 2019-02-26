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

 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Model = require('../../../src/domain/participant')

const endpointsFixtures = {
  FSPIOP_CALLBACK_URL_TRANSFER_POST: {
    type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
    value: 'http://localhost:3001/participants/dfsp1/notification1'
  },
  ALARM_NOTIFICATION_URL: {
    type: 'ALARM_NOTIFICATION_URL',
    value: 'http://localhost:3001/participants/dfsp1/notification2'
  }
}
exports.prepareData = async (name, endpointType) => {
  try {
    if (endpointsFixtures[endpointType] == null) {
      throw new Error('invalid endpointType')
    }
    await Model.addEndpoint(name, endpointsFixtures[endpointType])
    return endpointsFixtures[endpointType]
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.deletePreparedData = async (participantName) => {
  if (!participantName) {
    throw new Error('Please provide a valid participant name!')
  }

  try {
    return await Model.destroyParticipantEndpointByName(participantName)
  } catch (err) {
    throw new Error(err.message)
  }
}
