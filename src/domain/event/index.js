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
 * Deon Botha <deon.botha@modusbox.com>

 --------------
 ******/

'use strict'

const Model = require('./model')

const getAll = async () => {
  try {
    return await Model.getAll()
  } catch (e) {
    throw e
  }
}

const update = async (eventNameId, value, description) => {
  try {
    return await Model.update(eventNameId, value, description)
  } catch (e) {
    throw e
  }
}

const truncate = async () => {
  try {
    return await Model.truncate()
  } catch (e) {
    throw e
  }
}

const getById = async (eventNameId) => {
  try {
    return await Model.getById(eventNameId)
  } catch (e) {
    throw e
  }
}

const saveEventName = async (eventNameId, value, description) => {
  try {
    const eventName = {
      eventNameId, value, description
    }
    return await Model.saveEventName(eventName)
  } catch (e) {
    throw e
  }
}

module.exports = {
  getAll,
  update,
  truncate,
  getById,
  saveEventName
}
