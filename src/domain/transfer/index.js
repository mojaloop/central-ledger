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
const TransferError = require('../../models/transfer/transferError')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Metrics = require('@mojaloop/central-services-metrics')

const prepare = async (payload, stateReason = null, hasPassedValidation = true) => {
  const histTimerTransferServicePrepareEnd = Metrics.getHistogram(
    'domain_transfer',
    'prepare - Metrics for transfer domain',
    ['success', 'funcName']
  ).startTimer()
  try {
    const result = await TransferFacade.saveTransferPrepared(payload, stateReason, hasPassedValidation)
    histTimerTransferServicePrepareEnd({ success: true, funcName: 'prepare' })
    return result
  } catch (err) {
    histTimerTransferServicePrepareEnd({ success: false, funcName: 'prepare' })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const handlePayeeResponse = async (transferId, payload, action, fspiopError) => {
  const histTimerTransferServiceHandlePayeeResponseEnd = Metrics.getHistogram(
    'domain_transfer',
    'prepare - Metrics for transfer domain',
    ['success', 'funcName']
  ).startTimer()

  try {
    const transfer = await TransferFacade.savePayeeTransferResponse(transferId, payload, action, fspiopError)
    const result = TransferObjectTransform.toTransfer(transfer)
    histTimerTransferServiceHandlePayeeResponseEnd({ success: true, funcName: 'handlePayeeResponse' })
    return result
  } catch (err) {
    histTimerTransferServiceHandlePayeeResponseEnd({ success: false, funcName: 'handlePayeeResponse' })
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
    return TransferError.insert(transferId, transferStateChange.transferStateChangeId, errorCode, errorDescription)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const TransferService = {
  prepare,
  handlePayeeResponse,
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
