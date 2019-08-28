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
 * Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
--------------
 ******/

'use strict'

const TransferPreparationModule = require('./transfer')
const TransferModel = require('../../../src/models/transfer/transfer')
const Model = require('../../../src/models/transfer/transferExtension')
const TransferDuplicateCheckPreparationModule = require('./transferDuplicateCheck')
const Time = require('@mojaloop/central-services-shared').Util.Time
const ErrorHandler = require('@mojaloop/central-services-error-handling')

exports.prepareData = async () => {
  try {
    const transferDuplicateCheckResult = await TransferDuplicateCheckPreparationModule.prepareData() // participants + transferDuplicateCheck

    const transferResult = await TransferPreparationModule.prepareData(transferDuplicateCheckResult.transfer) // transfer

    await Model.saveTransferExtension({
      transferId: transferResult.transfer.transferId,
      key: 'extension.key',
      value: 'extension.value',
      createdDate: Time.getUTCString(new Date())
    })
    const transfer = await TransferModel.getById(transferResult.transfer.transferId)
    const extension = await Model.getByTransferId(transferResult.transfer.transferId)

    return {
      extension,
      transfer,
      participants: {
        participantPayer: transferDuplicateCheckResult.participantPayerResult,
        participantPayee: transferDuplicateCheckResult.participantPayeeResult
      }
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.deletePreparedData = async (extensionId, transferId, payerName, payeeName) => {
  try {
    return await Model.destroyByTransferId(transferId).then(async () => {
      return TransferPreparationModule.deletePreparedData(transferId, payerName, payeeName)
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
