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
 --------------
 ******/

'use strict'

const transferParticipantRoleTypes = [
  {
    'name': 'PAYER_DFSP',
    'description': 'The participant is the Payer DFSP in this transfer and is sending the funds'
  },
  {
    'name': 'PAYEE_DFSP',
    'description': 'The participant is the Payee DFSP in this transfer and is receiving the funds'
  },
  {
    'name': 'HUB',
    'description': 'The participant is representing the Hub Operator'
  },
  {
    'name': 'DFSP_SETTLEMENT_ACCOUNT',
    'description': 'Indicates the settlement account'
  },
  {
    'name': 'DFSP_POSITION_ACCOUNT',
    'description': 'Indicates the position account'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('transferParticipantRoleType').insert(transferParticipantRoleTypes)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading seeds for transferParticipantRoleType has failed with the following error: ${err}`)
      return -1000
    }
  }
}
