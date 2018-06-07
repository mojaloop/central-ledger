/*
- License
- --------------
- Copyright © 2017 Bill & Melinda Gates Foundation
- The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
- http://www.apache.org/licenses/LICENSE-2.0
- Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
- Contributors
- --------------
- This is the official list of the Mojaloop project contributors for this file.
- Names of the original copyright holders (individuals or organizations)
- should be listed with a '*' in the first column. People who have
- contributed from an organization can be listed under the organization
- that actually holds the copyright for their contributions (see the
- Gates Foundation organization for an example). Those individuals should have
- their names indented and be marked with a '-'. Email address can be added
- optionally within square brackets <email>.
- * Gates Foundation
- - Name Surname <name.surname@gatesfoundation.com>
- * Valentin Genev <valentin.genev@modusbox.com>
- * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
- * Miguel de Barros <miguel.debarros@modusbox.com>
- --------------
- ******/

'use strict'

/**
 * Model - ilp
 * @module src/models/ilp
 */

const Db = require('../db')
const Util = require('../lib/util')

/**
 * @function saveIlp
 *
 * @async
 * @description Insert new ilp
 *
 * @param {object} transfer - object containing all needed columns for ilp (transferId, packet, condition, fulfilment)
 *
 * @returns {number} - Returns the id of the newly created ilp, throws error if failure occurs
 */
exports.saveIlp = async (transfer) => {
  try {
    return await Db.ilp.insert({
      transferId: transfer.transferId,
      packet: transfer.packet,
      condition: transfer.condition,
      fulfilment: transfer.fulfilment
    })
  } catch (err) {
    throw new Error(err.message)
  }
}

/**
 * @function getByTransferId
 *
 * @async
 * @description Get a record from ilp table, filtered by transferId
 *
 * @param {number} transferId - the transferId connected to the wanted record
 *
 * @returns {object} - Returns an object of ilp, filtered by the requested transferId, throws error if failure occurs
 */
exports.getByTransferId = async (transferId) => {
  try {
    return await Db.ilp.findOne({ transferId: transferId })
  } catch (err) {
    throw new Error(err.message)
  }
}

/**
 * @function update
 *
 * @async
 * @description Get a record from ilp table, filtered by transferId
 *
 * @param {object} ilp - object containing all needed columns for ilp regarding this method (ilpId, transferId, packet, condition, fulfilment)
 *
 * @returns {object} - Returns an object of ilp, filtered by the requested transferId, throws error if failure occurs
 */
exports.update = async (ilp) => {
  const fields = {
    transferId: ilp.transferId,
    packet: ilp.packet,
    condition: ilp.condition,
    fulfilment: ilp.fulfilment
  }
  try {
    return await Db.ilp.update({ilpId: ilp.ilpId}, Util.filterUndefined(fields))
  } catch (err) {
    throw new Error(err.message)
  }
}

/**
 * @function destroyByTransferId
 *
 * @async
 * @description Destroy a record from transferState table, filtered by transferStateId
 *
 * @param {object} ilp - object containing all needed columns for ilp regarding the this method (transferId)
 *
 * @returns {number} - Returns a number of affected rows for the query, throws error if failure occurs
 */
exports.destroyByTransferId = async (ilp) => {
  try {
    return await Db.ilp.destroy({transferId: ilp.transferId})
  } catch (err) {
    throw new Error(err.message)
  }
}
