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
const TransferDuplicateCheckPreparationModule = require('./transferDuplicateCheck')
const TransferStatePreparationHelper = require('./transferState')
const StateChangeModel = require('../../../src/models/transfer/transferStateChange')
const TransferExtensionModel = require('../../../src/models/transfer/transferExtension')
const IlpModel = require('../../../src/models/transfer/ilpPacket')
const TransferFacade = require('../../../src/models/transfer/facade')
const TransferFulfilmentDuplicateCheckModel = require('../../../src/models/transfer/transferFulfilmentDuplicateCheck')
const TransferFulfilmentModel = require('../../../src/models/transfer/transferFulfilment')
const TransferParticipantModel = require('../../../src/models/transfer/transferParticipant')
const Enum = require('../../../src/lib/enum')
const Time = require('../../../src/lib/time')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

// TODO: add data to transferParticipant, transferParticipantRoleType, transferFulfilment

exports.prepareData = async () => {
  try {
    const transferDuplicateCheckResult = await TransferDuplicateCheckPreparationModule.prepareData() // participants + transferDuplicateCheck

    const transferResult = await TransferPreparationModule.prepareData(transferDuplicateCheckResult.transfer) // transfer

    const transferStateResults = TransferStatePreparationHelper.prepareData() // transfer seed

    await TransferExtensionModel.saveTransferExtension({
      transferId: transferResult.transfer.transferId,
      key: 'helper.extension.key',
      value: 'helper.extension.value',
      createdDate: Time.getUTCString(new Date())
    })

    await IlpModel.saveIlpPacket({
      transferId: transferResult.transfer.transferId,
      value: 'ILP Packet Value'
      // condition: 'test condition',
      // fulfilment: 'test fulfilment'
    })

    await StateChangeModel.saveTransferStateChange({
      transferId: transferResult.transfer.transferId,
      transferStateId: transferStateResults[0].transferStateId
    })

    const transferStateChangeResult = await StateChangeModel.getByTransferId(transferResult.transfer.transferId)
    const ilp = await IlpModel.getByTransferId(transferResult.transfer.transferId)
    const extension = await TransferExtensionModel.getByTransferId(transferResult.transfer.transferId)
    // let transfer = await TransferFacade.getById(transferResult.transfer.transferId)

    const transferId = transferResult.transfer.transferId
    await TransferFulfilmentDuplicateCheckModel.checkAndInsertDuplicateHash(transferId, 'helper.hash')
    await TransferFulfilmentModel.saveTransferFulfilment({
      transferId,
      ilpFulfilment: 'helper.oAKAAA',
      completedDate: Time.getUTCString(new Date()),
      isValid: true,
      createdDate: Time.getUTCString(new Date())
    })

    await TransferParticipantModel.saveTransferParticipant({
      transferParticipantId: transferDuplicateCheckResult.participantPayerResult.participant.participantId,
      transferId: transferResult.transfer.transferId,
      participantCurrencyId: transferDuplicateCheckResult.participantPayerResult.participantCurrencyId,
      transferParticipantRoleTypeId: Enum.TransferParticipantRoleType.PAYER_DFSP,
      ledgerEntryTypeId: Enum.LedgerAccountType.POSITION,
      amount: transferResult.transfer.amount
    })

    await TransferParticipantModel.saveTransferParticipant({
      transferParticipantId: transferDuplicateCheckResult.participantPayeeResult.participant.participantId,
      transferId: transferResult.transfer.transferId,
      participantCurrencyId: transferDuplicateCheckResult.participantPayeeResult.participantCurrencyId,
      transferParticipantRoleTypeId: Enum.TransferParticipantRoleType.PAYEE_DFSP,
      ledgerEntryTypeId: Enum.LedgerAccountType.POSITION,
      amount: -transferResult.transfer.amount
    })

    return {
      ilp,
      extension,
      transfer: transferResult.transfer,
      transferStateResults,
      transferStateChangeResult,
      participants: {
        participantPayer: transferResult.participantPayerResult,
        participantPayee: transferResult.participantPayeeResult
      }
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
        await TransferExtensionModel.destroyByTransferId({
          transferId: transferId
        }).then(async () => {
          // await TransferStatePreparationHelper.deletePreparedData()
          await TransferFacade.destroyByTransferId({ transferId: 'test_tr_id' }).then(async () => {
            await TransferPreparationModule.deletePreparedData(transferId, payerName, payeeName)
          })
        })
      })
    })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
