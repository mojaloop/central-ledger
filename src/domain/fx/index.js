/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
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
    await FxTransferModel.fxTransfer.saveFxFulfilResponse(transferId, payload, action, fspiopError)
    const result = {}
    histTimerTransferServiceHandlePayeeResponseEnd({ success: true, funcName: 'handleFulfilResponse' })
    return result
  } catch (err) {
    histTimerTransferServiceHandlePayeeResponseEnd({ success: false, funcName: 'handleFulfilResponse' })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const forwardedFxPrepare = async (commitRequestId) => {
  const histTimerTransferServicePrepareEnd = Metrics.getHistogram(
    'fx_domain_transfer',
    'prepare - Metrics for fx transfer domain',
    ['success', 'funcName']
  ).startTimer()
  try {
    const result = await FxTransferModel.fxTransfer.updateFxPrepareReservedForwarded(commitRequestId)
    histTimerTransferServicePrepareEnd({ success: true, funcName: 'forwardedFxPrepare' })
    return result
  } catch (err) {
    histTimerTransferServicePrepareEnd({ success: false, funcName: 'forwardedFxPrepare' })
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const TransferService = {
  handleFulfilResponse,
  forwardedFxPrepare,
  getByIdLight: FxTransferModel.fxTransfer.getByIdLight,
  Cyril
}

module.exports = TransferService
