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
 * Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 --------------
 ******/

'use strict'

const TransferPreparationModule = require('./transfer')
const TransferModel = require('../../../src/domain/transfer/models/transfer-read-model')
const Model = require('../../../src/models/extensions')

// const returnObject = {
//   "extension": {
//     "extensionId": 77,
//     "transferId": "tr15272357608111536",
//     "key": "extension.key",
//     "value": "extension.value",
//     "changedDate": "2018-05-25T08:09:21.000Z",
//     "changedBy": "extension.changedBy"
//   },
//   "transfer": {
//     "transferId": "tr15272357608111536",
//     "payeeParticipantId": 106,
//     "payerParticipantId": 105,
//     "amount": 100,
//     "currencyId": "USD",
//     "expirationDate": null,
//     "settlementWindowId": null,
//     "currency": "USD",
//     "payerFsp": "payer15272357607931221",
//     "payeeFsp": "payee1527235760806628",
//     "transferState": null,
//     "completedTimestamp": null,
//     "ilpPacket": null,
//     "condition": null,
//     "fulfilment": null
//   },
//   "participants": {
//     "participantPayer": {
//       "participantId": 105,
//       "currencyId": "USD",
//       "name": "payer15272357607931221",
//       "createdDate": "2018-05-25T05:09:20.000Z",
//       "isDisabled": 0
//     },
//     "participantPayee": {
//       "participantId": 106,
//       "currencyId": "USD",
//       "name": "payee1527235760806628",
//       "createdDate": "2018-05-25T05:09:20.000Z",
//       "isDisabled": 0
//     }
//   }
// }

exports.prepareData = async () => {
  try {
    let transferResult = await TransferPreparationModule.prepareData()

    await Model.saveExtension({
      transferId: transferResult.transferId,
      key: 'extension.key',
      value: 'extension.value',
      changedDate: new Date(),
      changedBy: 'extension.changedBy'

    })
    let transfer = await TransferModel.getById(transferResult.transferId)
    let extension = await Model.getByTransferId(transferResult.transferId)

    return {
      extension,
      transfer,
      participants: {
        participantPayer: transferResult.participantPayerResult,
        participantPayee: transferResult.participantPayeeResult
      }
    }
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.deletePreparedData = async (extensionId, transferId, payerName, payeeName) => {
  try {
    return await Model.destroyByTransferId({
      transferId: transferId
    }).then(async () => {
      return TransferPreparationModule.deletePreparedData(transferId, payerName, payeeName)
    })
  } catch (err) {
    throw new Error(err.message)
  }
}
