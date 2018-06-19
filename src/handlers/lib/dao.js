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

 * Lazola Lucas <lazola.lucas@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @module src/handlers/lib
 */

const Logger = require('@mojaloop/central-services-shared').Logger
const Participants = require('../../domain/participant')

/**
 * @function RetrieveAllParticipants
 *
 * @description Calls getAllParticipant DAO to retrieve a list of participants and then use that to get a list of names for the creation of topics
 *
 * @returns {list} - Returns a list participant names, throws error if failure occurs
 */
const retrieveAllParticipants = async () => {
  try {
    const participants = await Participants.getAll()
    return participants.map(participant => participant.name)
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

module.exports = {
  retrieveAllParticipants
}
