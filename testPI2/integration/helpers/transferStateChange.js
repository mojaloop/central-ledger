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
const TransferStatePreparationHelper = require('./transferState')
const Model = require('../../../src/domain/transfer/models/transferStateChanges')

// const preparedData = {
//   "success": true,
//   "transfer": {
//     "transferId": "tr15272393021422669",
//     "payeeParticipantId": 132,
//     "payerParticipantId": 131,
//     "amount": 100,
//     "currencyId": "USD",
//     "expirationDate": null,
//     "settlementWindowId": null,
//     "currency": "USD",
//     "payerFsp": "payer15272393021259681",
//     "payeeFsp": "payee15272393021389056",
//     "transferState": "TEST_RECEIVED",
//     "completedTimestamp": "2018-05-25T06:08:22.000Z",
//     "ilpPacket": null,
//     "condition": null,
//     "fulfilment": null
//   },
//   "transferStateChangeResult": {
//     "transferStateChangeId": 6,
//     "transferId": "tr15272393021422669",
//     "transferStateId": "TEST_RECEIVED",
//     "reason": null,
//     "changedDate": "2018-05-25T06:08:22.000Z"
//   },
//   "transferStateResults": [
//     {
//       "transferStateId": "TEST_RECEIVED",
//       "enumeration": "RECEIVED",
//       "description": "Next ledger has received the transfer."
//     },
//     {
//       "transferStateId": "TEST_RESERVED",
//       "enumeration": "RESERVED",
//       "description": "Next ledger has reserved the transfer."
//     },
//     {
//       "transferStateId": "TEST_COMMITTED",
//       "enumeration": "COMMITTED",
//       "description": "Next ledger has successfully performed the transfer."
//     },
//     {
//       "transferStateId": "TEST_ABORTED",
//       "enumeration": "ABORTED",
//       "description": "Next ledger has aborted the transfer due a rejection or failure to perform the transfer."
//     },
//     {
//       "transferStateId": "TEST_SETTLED",
//       "enumeration": "COMMITTED",
//       "description": "Ledger has settled the transfer"
//     }
//   ],
//   "participants": {
//     "participantPayer": {
//       "participantId": 131,
//       "currencyId": "USD",
//       "name": "payer15272393021259681",
//       "createdDate": "2018-05-25T06:08:22.000Z",
//       "isDisabled": 0
//     },
//     "participantPayee": {
//       "participantId": 132,
//       "currencyId": "USD",
//       "name": "payee15272393021389056",
//       "createdDate": "2018-05-25T06:08:22.000Z",
//       "isDisabled": 0
//     }
//   }
// }

exports.prepareData = async () => {
  try {
    let transferResult = await TransferPreparationModule.prepareData()
    let transferStateResults = await TransferStatePreparationHelper.prepareData()

    let saveResult = await Model.saveTransferStateChange({
      transferId: transferResult.transferId,
      transferStateId: transferStateResults[0].transferStateId
    })
    let transfer = await TransferModel.getById(transferResult.transferId)
    let transferStateChangeResult = await Model.getByTransferId(transferResult.transferId)

    return {
      success: !!(saveResult),
      transfer,
      transferStateResults,
      transferStateChangeResult,
      participants: {
        participantPayer: transferResult.participantPayerResult,
        participantPayee: transferResult.participantPayeeResult
      }
    }
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.deletePreparedData = async (transferId, payerName, payeeName) => {
  try {
    return await Model.truncate({
      transferId: transferId
    }).then(async () => {
      await TransferStatePreparationHelper.deletePreparedData()
      await TransferPreparationModule.deletePreparedData(transferId, payerName, payeeName)
    })
  } catch (err) {
    throw new Error(err.message)
  }
}
