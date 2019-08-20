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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * @module src/domain/transfer/
 */

const TransferFacade = require('../../models/transfer/facade')
const TransferModel = require('../../models/transfer/transfer')
const TransferStateChangeModel = require('../../models/transfer/transferStateChange')
const TransferErrorModel = require('../../models/transfer/transferError')
const TransferDuplicateCheckModel = require('../../models/transfer/transferDuplicateCheck')
const TransferFulfilmentDuplicateCheckModel = require('../../models/transfer/transferFulfilmentDuplicateCheck')
const TransferErrorDuplicateCheckModel = require('../../models/transfer/transferErrorDuplicateCheck')
const TransferObjectTransform = require('./transform')
const Crypto = require('crypto')
const TransferError = require('../../models/transfer/transferError')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const prepare = async (payload, stateReason = null, hasPassedValidation = true) => {
  try {
    return await TransferFacade.saveTransferPrepared(payload, stateReason, hasPassedValidation)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const fulfil = async (transferId, payload) => {
  // eslint-disable-next-line no-useless-catch
  try {
    const isCommit = true
    const transfer = await TransferFacade.saveTransferFulfilled(transferId, payload, isCommit)
    return TransferObjectTransform.toTransfer(transfer)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const reject = async (transferId, payload) => {
  try {
    const isCommit = false
    const stateReason = ErrorHandler.Enums.FSPIOPErrorCodes.PAYEE_REJECTED_TXN.errorDescription
    const transfer = await TransferFacade.saveTransferFulfilled(transferId, payload, isCommit, stateReason)
    return TransferObjectTransform.toTransfer(transfer)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const abort = async (transferId, payload) => {
  try {
    return TransferFacade.saveTransferAborted(transferId, payload)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/**
 * @function ValidateDuplicateHash
 *
 * @async
 * @description This checks if there is a matching hash for a transfer request in transferDuplicateCheck table, if it does not exist, it will be inserted
 *
 * TransferDuplicateCheckModel.checkAndInsertDuplicateHash called to check the existing hash or insert the hash if not exists in the database
 *
 * @param {string} payload - the transfer object
 *
 * @returns {object} - Returns the result of the comparision of the hash if exists, otherwise false values, or throws an error if failed
 * Example:
 * ```
 * {
 *    existsMatching: true,
 *    existsNotMatching: false
 * }
 * ```
 */

const validateDuplicateHash = async (transferId, payload, isFulfilment = false, isTransferError = false) => {
  try {
    let result
    if (!payload) {
      throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, 'Invalid payload')
    }
    const hashSha256 = Crypto.createHash('sha256')
    let hash = JSON.stringify(payload)
    hash = hashSha256.update(hash)
    // remove trailing '=' as per specification
    hash = hashSha256.digest(hash).toString('base64').slice(0, -1)

    if (!isFulfilment && !isTransferError) {
      result = await TransferDuplicateCheckModel.checkAndInsertDuplicateHash(transferId, hash)
    } else if (!isTransferError) {
      result = await TransferFulfilmentDuplicateCheckModel.checkAndInsertDuplicateHash(transferId, hash)
    } else {
      result = await TransferErrorDuplicateCheckModel.checkAndInsertDuplicateHash(transferId, hash)
    }
    return result
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

/**
 * @function LogTransferError
 *
 * @async
 * @description This will insert a record into the transferError table for the latest transfer stage change id.
 *
 * TransferStateChangeModel.getByTransferId called to get the latest transfer state change id
 * TransferError.insert called to insert the record into the transferError table
 *
 * @param {string} transferId - the transfer id
 * @param {integer} errorCode - the error code
 * @param {string} errorDescription - the description error
 *
 * @returns {integer} - Returns the id of the transferError record if successful, or throws an error if failed
 */

const logTransferError = async (transferId, errorCode, errorDescription) => {
  try {
    const transferStateChange = await TransferStateChangeModel.getByTransferId(transferId)
    return TransferError.insert(transferStateChange.transferStateChangeId, errorCode, errorDescription)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const TransferService = {
  prepare,
  fulfil,
  reject,
  abort,
  validateDuplicateHash,
  logTransferError,
  getTransferErrorByTransferId: TransferErrorModel.getByTransferId,
  getTransferById: TransferModel.getById,
  getById: TransferFacade.getById,
  getByIdLight: TransferFacade.getByIdLight,
  getAll: TransferFacade.getAll,
  getTransferState: TransferStateChangeModel.getByTransferId,
  getTransferInfoToChangePosition: TransferFacade.getTransferInfoToChangePosition,
  saveTransferStateChange: TransferStateChangeModel.saveTransferStateChange,
  getTransferStateChange: TransferFacade.getTransferStateByTransferId,
  reconciliationTransferPrepare: TransferFacade.reconciliationTransferPrepare,
  reconciliationTransferReserve: TransferFacade.reconciliationTransferReserve,
  reconciliationTransferCommit: TransferFacade.reconciliationTransferCommit,
  reconciliationTransferAbort: TransferFacade.reconciliationTransferAbort,
  getTransferParticipant: TransferFacade.getTransferParticipant,
  getTransferDuplicateCheck: TransferDuplicateCheckModel.getTransferDuplicateCheck,
  saveTransferDuplicateCheck: TransferDuplicateCheckModel.saveTransferDuplicateCheck,
  getTransferFulfilmentDuplicateCheck: TransferFulfilmentDuplicateCheckModel.getTransferFulfilmentDuplicateCheck,
  saveTransferFulfilmentDuplicateCheck: TransferFulfilmentDuplicateCheckModel.saveTransferFulfilmentDuplicateCheck,
  getTransferErrorDuplicateCheck: TransferErrorDuplicateCheckModel.getTransferErrorDuplicateCheck,
  saveTransferErrorDuplicateCheck: TransferErrorDuplicateCheckModel.saveTransferErrorDuplicateCheck
}

module.exports = TransferService
