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

// TODO: determine if this script is needed (note: it is used for seeds during integration tests)

'use strict'

// const Moment = require('moment')
const Db = require('../../db')
// const TransferState = require('../state')
const Logger = require('@mojaloop/central-services-shared').Logger

const saveTransferState = async (transferState) => {
  Logger.debug('save transferState' + transferState.toString())

  try {
    return await Db.transferState.insert(transferState)
  } catch (err) {
    throw new Error(err.message)
  }
}

// const getByTransferStateId = (id) => {
//   return Db.transferState.query(builder => {
//     return builder
//       .where({ transferStateId: id })
//       .select('transferState.*')
//       .first()
//   })
// }

const getByTransferStateId = (id) => {
  try {
    return Db.transferState.findOne({ transferStateId: id })
  } catch (err) {
    throw new Error(err.message)
  }
}

const getAll = () => {
  try {
    return Db.transferState.find({})
  } catch (err) {
    throw new Error(err.message)
  }
}

// const truncatetransferState = () => {
//   return Db.transferState.truncate()
// }

const destroyTransferState = () => {
  try {
    return Db.transferState.destroy()
  } catch (err) {
    throw new Error(err.message)
  }
}

const destroyTransferStateById = (id) => {
  try {
    return Db.transferState.destroy({ transferStateId: id })
  } catch (err) {
    throw new Error(err.message)
  }
}

module.exports = {
  saveTransferState,
  getByTransferStateId,
  getAll,
  // truncatetransferState,
  destroyTransferState,
  destroyTransferStateById
}
