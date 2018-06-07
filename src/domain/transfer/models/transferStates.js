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
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * Model - transferStates
 * @module src/domain/transfer/models/transferStates
 */

// const Moment = require('moment')
const Db = require('../../../db')
// const TransferState = require('../state')
const Logger = require('@mojaloop/central-services-shared').Logger

/**
 * @function saveTransferState
 *
 * @async
 * @description Insert new transfer state
 *
 * @param {object} transferState - object containing all needed columns for transferState (transferStateId, enumeration, description)
 *
 * @returns {number} - Returns the id of the newly created transfer state, throws error if failure occurs
 */
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

/**
 * @function getByTransferStateId
 *
 * @async
 * @description Get a record from transferState table, filtered by transferStateId
 *
 * @param {number} id - the transferStateId of the wanted record
 *
 * @returns {object} - Returns an object of transfer state, filtered by the requested transferStateId, throws error if failure occurs
 */
const getByTransferStateId = (id) => {
  try {
    return Db.transferState.findOne({ transferStateId: id })
  } catch (err) {
    throw new Error(err.message)
  }
}

// const getAll = () => {
//   return Db.transferState.query(builder => {
//     return builder
//       .select('transferState.*')
//   })
// }

/**
 * @function getAll
 *
 * @async
 * @description Get all records from transferState table
 * @returns {list} - Returns a list of transfer states, throws error if failure occurs
 */
const getAll = () => {
  try {
    return Db.transferState.find({})
  } catch (err) {
    throw new Error(err.message)
  }
}

// const truncateTransferStates = () => {
//   return Db.transferState.truncate()
// }

/**
 * @function destroyTransferStates
 *
 * @async
 * @description Destroy all records from transferState table
 * @returns {number} - Returns a number of affected rows for the query, throws error if failure occurs
 */
const destroyTransferStates = () => {
  try {
    return Db.transferState.destroy()
  } catch (err) {
    throw new Error(err.message)
  }
}

/**
 * @function destroyTransferStatesById
 *
 * @async
 * @description Destroy a record from transferState table, filtered by transferStateId
 *
 * @param {number} id - the transferStateId of the wanted record
 *
 * @returns {number} - Returns a number of affected rows for the query, throws error if failure occurs
 */
const destroyTransferStatesById = (id) => {
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
  // truncateTransferStates,
  destroyTransferStates,
  destroyTransferStatesById
}
