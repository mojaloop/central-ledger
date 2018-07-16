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
 --------------
 ******/

'use strict'

const TransferPreparationModule = require('./transferTestHelper')
const TransferModel = require('../../../src/models/transfer/facade')
const IlpPacketModel = require('../../../src/models/transfer/ilpPacket')

exports.prepareData = async () => {
  try {
    let transferResult = await TransferPreparationModule.prepareData()
    let transfer = await TransferModel.getById(transferResult.transfer.transferId)
    let ilp = await IlpPacketModel.getByTransferId(transferResult.transfer.transferId)

    return {
      ilp,
      transfer,
      participantPayer: transferResult.participantPayerResult,
      participantPayee: transferResult.participantPayeeResult
    }
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.deletePreparedData = async (ilpId, transferId, payerName, payeeName) => {
  try {
    return await IlpPacketModel.destroyByTransferId({
      transferId: transferId
    }).then(async () => {
      return TransferPreparationModule.deletePreparedData(transferId, payerName, payeeName)
    })
  } catch (err) {
    throw new Error(err.message)
  }
}
