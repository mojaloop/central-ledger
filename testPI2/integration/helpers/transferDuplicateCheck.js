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

const Model = require('../../../src/models/transfer/transferDuplicateCheck')
const ParticipantPreparationModule = require('./participant')
const time = require('../../../src/lib/time')
const Crypto = require('crypto')

exports.prepareData = async () => {
  try {
    let participantPayerResult = await ParticipantPreparationModule.prepareData('payer')
    let participantPayeeResult = await ParticipantPreparationModule.prepareData('payee')

    let transferId = 'tr' + time.msToday()
    let payload = {
      payerFsp: participantPayerResult.name,
      payeeFsp: participantPayeeResult.name,
      amount: {
        amount: 100,
        currency: 'USD'
      },
      condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
      ilpPacket: 'AQAAAAAAAABkEGcuZXdwMjEuaWQuODAwMjCCAhd7InRyYW5zYWN0aW9uSWQiOiJmODU0NzdkYi0xMzVkLTRlMDgtYThiNy0xMmIyMmQ4MmMwZDYiLCJxdW90ZUlkIjoiOWU2NGYzMjEtYzMyNC00ZDI0LTg5MmYtYzQ3ZWY0ZThkZTkxIiwicGF5ZWUiOnsicGFydHlJZEluZm8iOnsicGFydHlJZFR5cGUiOiJNU0lTRE4iLCJwYXJ0eUlkZW50aWZpZXIiOiIyNTYxMjM0NTYiLCJmc3BJZCI6IjIxIn19LCJwYXllciI6eyJwYXJ0eUlkSW5mbyI6eyJwYXJ0eUlkVHlwZSI6Ik1TSVNETiIsInBhcnR5SWRlbnRpZmllciI6IjI1NjIwMTAwMDAxIiwiZnNwSWQiOiIyMCJ9LCJwZXJzb25hbEluZm8iOnsiY29tcGxleE5hbWUiOnsiZmlyc3ROYW1lIjoiTWF0cyIsImxhc3ROYW1lIjoiSGFnbWFuIn0sImRhdGVPZkJpcnRoIjoiMTk4My0xMC0yNSJ9fSwiYW1vdW50Ijp7ImFtb3VudCI6IjEwMCIsImN1cnJlbmN5IjoiVVNEIn0sInRyYW5zYWN0aW9uVHlwZSI6eyJzY2VuYXJpbyI6IlRSQU5TRkVSIiwiaW5pdGlhdG9yIjoiUEFZRVIiLCJpbml0aWF0b3JUeXBlIjoiQ09OU1VNRVIifSwibm90ZSI6ImhlaiJ9',
      expiration: new Date()

    }
    let transfer = {
      transferId: transferId,
      amount: payload.amount.amount,
      currencyId: payload.amount.currency,
      ilpCondition: payload.condition,
      expirationDate: payload.expiration
    }

    const hashSha256 = Crypto.createHash('sha256')
    let hash = JSON.stringify(payload)
    hash = hashSha256.update(hash)
    hash = hashSha256.digest(hash).toString('base64').slice(0, -1) // removing the trailing '=' as per the specification

    const saveResult = await Model.saveTransferDuplicateCheck({
      transferId,
      hash
    })

    return {
      success: !!(saveResult),
      transferDuplicateCheck: { transferId, hash },
      transfer,
      participantPayerResult,
      participantPayeeResult
    }
  } catch (err) {
    throw new Error(err.message)
  }
}

// exports.deletePreparedData = async (transferId, payerName, payeeName) => {
//   try {
//     return await Model.truncate({
//       transferId: transferId
//     }).then(async () => {
//       await TransferDuplicateCheckPreparationHelper.deletePreparedData()
//       await TransferPreparationModule.deletePreparedData(transferId, payerName, payeeName)
//     })
//   } catch (err) {
//     throw new Error(err.message)
//   }
// }
