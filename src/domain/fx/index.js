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

 * Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 ******/

'use strict'

/**
 * @module src/domain/transfer/
 */

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Metrics = require('@mojaloop/central-services-metrics')
const FxTransferModel = require('../../models/fxTransfer')
// const TransferObjectTransform = require('./transform')
const Cyril = require('./cyril')


const handleFulfilResponse = async (transferId, payload, action, fspiopError) => {
  const histTimerTransferServiceHandlePayeeResponseEnd = Metrics.getHistogram(
    'fx_domain_transfer',
    'prepare - Metrics for fx transfer domain',
    ['success', 'funcName']
  ).startTimer()

  try {
    const fxTransfer = await FxTransferModel.fxTransfer.saveFxFulfilResponse(transferId, payload, action, fspiopError)
    // const result = TransferObjectTransform.toTransfer(fxTransfer)
    const result= {}
    histTimerTransferServiceHandlePayeeResponseEnd({ success: true, funcName: 'handleFulfilResponse' })
    return result
  } catch (err) {
    histTimerTransferServiceHandlePayeeResponseEnd({ success: false, funcName: 'handleFulfilResponse' })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

// TODO: Need to implement this for fxTransferError
// /**
//  * @function LogFxTransferError
//  *
//  * @async
//  * @description This will insert a record into the fxTransferError table for the latest fxTransfer stage change id.
//  *
//  * FxTransferModel.stateChange.getByCommitRequestId called to get the latest fx transfer state change id
//  * FxTransferModel.error.insert called to insert the record into the fxTransferError table
//  *
//  * @param {string} commitRequestId - the transfer id
//  * @param {integer} errorCode - the error code
//  * @param {string} errorDescription - the description error
//  *
//  * @returns {integer} - Returns the id of the transferError record if successful, or throws an error if failed
//  */

// const logFxTransferError = async (commitRequestId, errorCode, errorDescription) => {
//   try {
//     const transferStateChange = await FxTransferModel.stateChange.getByCommitRequestId(commitRequestId)
//     return FxTransferModel.error.insert(commitRequestId, transferStateChange.fxTransferStateChangeId, errorCode, errorDescription)
//   } catch (err) {
//     throw ErrorHandler.Factory.reformatFSPIOPError(err)
//   }
// }

const TransferService = {
  handleFulfilResponse,
  // logFxTransferError,
  Cyril
}

module.exports = TransferService
