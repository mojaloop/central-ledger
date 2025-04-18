/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
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

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 * Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

// const ParticipantPreparationModule = require('./participant')
const Model = require('../../../src/models/transfer/transfer')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
// const time = require('../../../src/lib/time')

// const transferFacade = require('../../../src/models/transfer/facade')

exports.prepareData = async (transfer) => {
  try {
    // let participantPayerResult = await ParticipantPreparationModule.prepareData('payer')
    // let participantPayeeResult = await ParticipantPreparationModule.prepareData('payee')

    // let transferId = 'tr' + time.msToday()
    await Model.saveTransfer(transfer)

    return {
      transfer: {
        transferId: transfer.transferId,
        amount: transfer.amount,
        currencyId: transfer.currencyId
      }
      // ,
      // participantPayerResult,
      // participantPayeeResult
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

// exports.deletePreparedData = async (transferId, payerName, payeeName) => {
exports.deletePreparedData = async (transferId) => {
  try {
    return Model.destroyById(transferId)
    // .then(async () => {
    //   let participantPayerResult = await ParticipantPreparationModule.deletePreparedData(payerName)
    //   let participantPayeeResult = await ParticipantPreparationModule.deletePreparedData(payeeName)
    //   return {
    //     participantPayerResult,
    //     participantPayeeResult
    //   }
    // })
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
