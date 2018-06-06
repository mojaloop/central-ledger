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
 * @module src/domain/transfer
 */

const P = require('bluebird')
const TransferQueries = require('./queries')
const SettleableTransfersReadModel = require('../../models/settleable-transfers-read-model')
const SettlementModel = require('../../models/settlement')
const Commands = require('./commands')
const Translator = require('./translator')
const RejectionType = require('./rejection-type')
const State = require('./state')
const Events = require('../../lib/events')
const Errors = require('../../errors')

/**
 * @function getById
 *
 * @description Queries the transfer, participant, transferStateChange and ilp tables with the given transfer Id
 * Returns a transferResult object from the database
 * @param {string} id Participant Id
 * @returns {Object} transferResult object
 */
const getById = (id) => {
  return TransferQueries.getById(id)
}

/**
 * @function getAll
 *
 * @description Queries the transfer, participant, transferStateChange and ilp tables
 * Returns a transferResult list from the database
 * @returns {Object|Array} List of transferResults
 */
const getAll = () => {
  return TransferQueries.getAll()
}

/**
 * @function getFulfillment
 *
 * @description Gets the fulfillment by transfer id
 * Returns a transfer fulfilment
 * @param {string} id Participant Id
 * @returns {Promise} Promise object representing a transfer fulfilment
 * @throws {TransferNotFoundError}
 * @throws {TransferNotConditionalError}
 * @throws {AlreadyRolledBackError}
 * @throws {MissingFulfillmentError}
 */
const getFulfillment = (id) => {
  return getById(id)
    .then(transfer => {
      if (!transfer) {
        throw new Errors.TransferNotFoundError()
      }
      if (!transfer.executionCondition) {
        throw new Errors.TransferNotConditionalError()
      }
      if (transfer.state === State.REJECTED) {
        throw new Errors.AlreadyRolledBackError()
      }
      if (!transfer.fulfilment) {
        throw new Errors.MissingFulfillmentError()
      }
      return transfer.fulfilment
    })
}

/**
 * @function prepare
 *
 * @description Create a prepare transfer and persist it to the database
 * Returns the prepared transfer object
 * @param {Object} payload transfer object to be prepared
 * @param {Object} stateReason Defaults to Null
 * @param {boolean} hasPassedValidation defaults to true
 * @returns {Object} Prepared transfer objectTransfer
 * @throws {Exception}
 */
const prepare = async (payload, stateReason = null, hasPassedValidation = true) => {
  try {
    const result = await Commands.prepare(payload, stateReason, hasPassedValidation)
    const t = Translator.toTransfer(result)
    Events.emitTransferPrepared(t)
    return {transfer: t}
  } catch (e) {
    throw e
  }
}

/**
 * @function reject
 *
 * @description Rejects a prepared transfer record
 * Returns an object with the alreadyRejected indicator value and the transfer state change value
 * @param {String} stateReason Rejection state change reason
 * @param {string} transferId Transfer Id of the transfer record to be rejected
 * @returns {Object} Rejected transfer object
 * @throws {Exception}
 */
const reject = async (stateReason, transferId) => {
  const {alreadyRejected, transferStateChange} = await Commands.reject(stateReason, transferId)
  if (!alreadyRejected) {
    Events.emitTransferRejected(transferStateChange)
  }
  return {alreadyRejected, transferStateChange}
}

const expire = (id) => {
  return reject({id, rejection_reason: RejectionType.EXPIRED})
}

/**
 * @function fulfil
 *
 * @description Persists a transfer as fulfilled to the database
 * Returns a transfer object that was fulfilled
 * @param {Obj} fulfilment Transfer object to be fulfilled
 * @returns {Promise} Promise object represents the fulfilled transfer
 * @throws {UnpreparedTransferError}
 * @throws {ExpiredTransferError}
 */
const fulfil = (fulfilment) => {
  return Commands.fulfil(fulfilment)
    .then(transfer => {
      const t = Translator.toTransfer(transfer)
      Events.emitTransferExecuted(t, {execution_condition_fulfillment: fulfilment.fulfilment})
      return t
    })
    .catch(err => {
      if (typeof err === Errors.ExpiredTransferError) {
        return expire(fulfilment.id)
          .then(() => { throw new Errors.UnpreparedTransferError() })
      } else {
        throw err
      }
    })
}

/**
 * @function rejectExpired
 *
 * @description Runs through all expired transfers and set them to rejected
 * Returns a map of expired transfers that were succesfully rejected
 * @returns {Promise} Map of rejected transfer id's
 */
const rejectExpired = () => {
  const rejections = TransferQueries.findExpired().then(expired => expired.map(x => expire(x.transferId)))
  return P.all(rejections).then(rejections => {
    return rejections.map(r => r.transfer.id)
  })
}

/**
 * @function settle
 *
 * @async
 * @description Generates an settlement id for each transfer that can been settled
 * Returns an object of settled transfers
 * @returns {Promise} Object transfers settled
 * @returns {Promise} Resolved promise or a object of settled transfers
 */
const settle = async () => {
  const settlementId = SettlementModel.generateId()
  const settledTransfers = SettlementModel.create(settlementId, 'transfer').then(() => {
    return SettleableTransfersReadModel.getSettleableTransfers().then(transfers => {
      transfers.forEach(transfer => {
        Commands.settle({id: transfer.transferId, settlement_id: settlementId})
      })
      return transfers
    })
  })

  return P.all(settledTransfers).then(settledTransfers => {
    if (settledTransfers.length > 0) {
      return settledTransfers
    } else {
      return P.resolve([])
    }
  })
}

module.exports = {
  fulfil,
  getById,
  getAll,
  getFulfillment,
  prepare,
  reject,
  rejectExpired,
  settle
}

