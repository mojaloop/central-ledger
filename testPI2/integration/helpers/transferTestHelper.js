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
const TransferStatePreparationHelper = require('./transferState')
const StateChangeModel = require('../../../src/domain/transfer/models/transferStateChanges')
const ExtensionModel = require('../../../src/models/extensions')
const IlpModel = require('../../../src/models/ilp')
const TransferModel = require('../../../src/domain/transfer/models/transfer-read-model')

// const preparedData = {
//   'ilp': {
//     'ilpId': 4,
//     'transferId': 'tr15277490950618416',
//     'packet': 'test packet',
//     'condition': 'test condition',
//     'fulfilment': 'test fulfilment',
//     'payeeParticipantId': 12,
//     'payerParticipantId': 11,
//     'amount': 100,
//     'currencyId': 'USD',
//     'expirationDate': null,
//     'transferSettlementBatchId': null
//   },
//   'extension': {
//     'extensionId': 4,
//     'transferId': 'tr15277490950618416',
//     'key': 'extension.key',
//     'value': 'extension.value',
//     'changedDate': '2018-05-31T06:44:55.000Z',
//     'changedBy': 'extension.changedBy'
//   },
//   'transfer': {
//     'transferId': 'tr15277490950618416',
//     'payeeParticipantId': 12,
//     'payerParticipantId': 11,
//     'amount': 100,
//     'currencyId': 'USD',
//     'expirationDate': null,
//     'transferSettlementBatchId': null,
//     'currency': 'USD',
//     'payerFsp': 'payer1527749095045383',
//     'payeeFsp': 'payee15277490950569075',
//     'transferState': 'TEST_RECEIVED',
//     'completedTimestamp': '2018-05-31T03:44:55.000Z',
//     'ilpPacket': 'test packet',
//     'condition': 'test condition',
//     'fulfilment': 'test fulfilment'
//   },
//   'transferStateResults': [
//     {
//       'transferStateId': 'TEST_RECEIVED',
//       'enumeration': 'RECEIVED',
//       'description': 'Next ledger has received the transfer.'
//     },
//     {
//       'transferStateId': 'TEST_RESERVED',
//       'enumeration': 'RESERVED',
//       'description': 'Next ledger has reserved the transfer.'
//     },
//     {
//       'transferStateId': 'TEST_COMMITTED',
//       'enumeration': 'COMMITTED',
//       'description': 'Next ledger has successfully performed the transfer.'
//     },
//     {
//       'transferStateId': 'TEST_ABORTED',
//       'enumeration': 'ABORTED',
//       'description': 'Next ledger has aborted the transfer due a rejection or failure to perform the transfer.'
//     },
//     {
//       'transferStateId': 'TEST_SETTLED',
//       'enumeration': 'COMMITTED',
//       'description': 'Ledger has settled the transfer'
//     }
//   ],
//   'transferStateChangeResult': {
//     'transferStateChangeId': 4,
//     'transferId': 'tr15277490950618416',
//     'transferStateId': 'TEST_RECEIVED',
//     'reason': null,
//     'changedDate': '2018-05-31T03:44:55.000Z'
//   },
//   'participants': {
//     'participantPayer': {
//       'participantId': 11,
//       'currencyId': 'USD',
//       'name': 'payer1527749095045383',
//       'createdDate': '2018-05-31T03:44:55.000Z',
//       'isDisabled': 0
//     },
//     'participantPayee': {
//       'participantId': 12,
//       'currencyId': 'USD',
//       'name': 'payee15277490950569075',
//       'createdDate': '2018-05-31T03:44:55.000Z',
//       'isDisabled': 0
//     }
//   }
// }

exports.prepareData = async () => {
  try {
    let transferResult = await TransferPreparationModule.prepareData() // participants + transfer
    let transferStateResults = await TransferStatePreparationHelper.prepareData() // transfer seed

    await ExtensionModel.saveExtension({
      transferId: transferResult.transferId,
      key: 'extension.key',
      value: 'extension.value',
      changedDate: new Date(),
      changedBy: 'extension.changedBy'

    })

    await IlpModel.saveIlp({
      transferId: transferResult.transferId,
      packet: 'test packet',
      condition: 'test condition',
      fulfilment: 'test fulfilment'
    })

    await StateChangeModel.saveTransferStateChange({
      transferId: transferResult.transferId,
      transferStateId: transferStateResults[0].transferStateId
    })

    let transferStateChangeResult = await StateChangeModel.getByTransferId(transferResult.transferId)
    let ilp = await IlpModel.getByTransferId(transferResult.transferId)
    let extension = await ExtensionModel.getByTransferId(transferResult.transferId)
    let transfer = await TransferModel.getById(transferResult.transferId)

    return {
      ilp,
      extension,
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
    return await StateChangeModel.truncate({
      transferId: transferId
    }).then(async () => {
      await IlpModel.destroyByTransferId({
        transferId: transferId
      }).then(async () => {
        await ExtensionModel.destroyByTransferId({
          transferId: transferId
        }).then(async () => {
          await TransferStatePreparationHelper.deletePreparedData()
          await TransferModel.destroyByTransferId({transferId: 'test_tr_id'}).then(async () => {
            await TransferPreparationModule.deletePreparedData(transferId, payerName, payeeName)
          })
        })
      })
    })
  } catch (err) {
    throw new Error(err.message)
  }
}
