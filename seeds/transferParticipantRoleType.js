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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 * Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 ******/

'use strict'

const transferParticipantRoleTypes = [
  {
    name: 'PAYER_DFSP',
    description: 'The participant is the Payer DFSP in this transfer and is sending the funds'
  },
  {
    name: 'PAYEE_DFSP',
    description: 'The participant is the Payee DFSP in this transfer and is receiving the funds'
  },
  {
    name: 'HUB',
    description: 'The participant is representing the Hub Operator'
  },
  {
    name: 'DFSP_SETTLEMENT',
    description: 'Indicates the settlement account'
  },
  {
    name: 'DFSP_POSITION',
    description: 'Indicates the position account'
  },
  {
    name: 'INITIATING_FSP',
    description: 'Identifier for the FSP who is requesting a currency conversion'
  },
  {
    name: 'COUNTER_PARTY_FSP',
    description: 'Identifier for the FXP who is performing the currency conversion'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('transferParticipantRoleType').insert(transferParticipantRoleTypes).onConflict('name').ignore()
  } catch (err) {
    console.log(`Uploading seeds for transferParticipantRoleType has failed with the following error: ${err}`)
    return -1000
  }
}
