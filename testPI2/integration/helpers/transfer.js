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

const ParticipantPreparationModule = require('./participant')
const Model = require('../../../src/models/transfer/transfer')
// const transferFacade = require('../../../src/models/transfer/facade')

exports.prepareData = async () => {
  try {
    let participantPayerResult = await ParticipantPreparationModule.prepareData('payer')
    let participantPayeeResult = await ParticipantPreparationModule.prepareData('payee')

    let transferId = 'tr' + new Date().getTime() + Math.ceil((Math.random() * 10000))
    await Model.saveTransfer({
      transferId: transferId,
      amount: 100,
      currencyId: 'USD',
      ilpCondition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
      expirationDate: new Date()
    })

    return {
      transfer: {
        transferId,
        amount: 100,
        currencyId: 'USD'
      },
      participantPayerResult,
      participantPayeeResult
    }
  } catch (err) {
    throw new Error(err.message)
  }
}

exports.deletePreparedData = async (transferId, payerName, payeeName) => {
  try {
    return Model.destroyById(transferId).then(async () => {
      let participantPayerResult = await ParticipantPreparationModule.deletePreparedData(payerName)
      let participantPayeeResult = await ParticipantPreparationModule.deletePreparedData(payeeName)
      return {
        participantPayerResult,
        participantPayeeResult
      }
    })
  } catch (err) {
    throw new Error(err.message)
  }
}
