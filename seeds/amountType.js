/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Initial contribution
 --------------------
 The initial functionality and code base was donated by the Mowali project working in conjunction with MTN and Orange as service provides.
 * Project: Mowali

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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

// Notes: these changes are required for the quoting-service and are not used by central-ledger
'use strict'

const amountType = [
  {
    name: 'SEND',
    description: 'Amount the Payer would like to send; that is, the amount that should be withdrawn from the Payer account including any fees'
  },
  {
    name: 'RECEIVE',
    description: 'Amount the Payer would like the Payee to receive; that is, the amount that should be sent to the receiver exclusive fees'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('amountType').insert(amountType).onConflict('name').ignore()
  } catch (err) {
    console.log(`Uploading seeds for amountType has failed with the following error: ${err}`)
    return -1000
  }
}
