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

 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
--------------
 ******/

'use strict'

const TransferPreparationModule = require('./transfer')
const TransferDuplicateCheckPreparationModule = require('./transferDuplicateCheck')
const TransferErrorModel = require('../../../src/models/transfer/transferError')
const TransferStateChangeModel = require('../../../src/models/transfer/transferStateChange')
const TransferStatePreparationHelper = require('./transferState')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
exports.prepareData = async () => {
  try {
    const transferDuplicateCheckResult = await TransferDuplicateCheckPreparationModule.prepareData() // participants + transferDuplicateCheck
    const transferResult = await TransferPreparationModule.prepareData(transferDuplicateCheckResult.transfer) // transfer
    TransferStatePreparationHelper.prepareData() // transfer seed

    await TransferStateChangeModel.saveTransferStateChange({
      transferId: transferResult.transfer.transferId,
      transferStateId: 'INVALID'
    })
    const transferStateChange = await TransferStateChangeModel.getByTransferId(transferResult.transfer.transferId)
    await TransferErrorModel.insert(transferStateChange.transferStateChangeId, 3100, 'Invalid Request')

    const transferError = await TransferErrorModel.getByTransferStateChangeId(transferStateChange.transferStateChangeId)

    return {
      transferError,
      transferStateChange,
      participants: {
        participantPayer: transferDuplicateCheckResult.participantPayerResult,
        participantPayee: transferDuplicateCheckResult.participantPayeeResult
      }
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.deletePreparedData = async (transferId, payerName, payeeName) => {
  try {
    return TransferPreparationModule.deletePreparedData(transferId, payerName, payeeName)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
