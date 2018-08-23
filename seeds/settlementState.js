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

const settlementStates = [
  {
    'settlementStateId': 'PENDING_SETTLEMENT',
    'enumeration': 'PENDING_SETTLEMENT',
    'description': 'The net settlement report for this window has been taken, with the parameter set to indicate that settlement is to be processed.'
  },
  {
    'settlementStateId': 'SETTLED',
    'enumeration': 'SETTLED',
    'description': 'The Hub Operator/Settlement Bank has confirmed that all the participants that engaged in the settlement window have now settled their payments in accordance with the net settlement report.'
  },
  {
    'settlementStateId': 'NOT_SETTLED',
    'enumeration': 'NOT_SETTLED',
    'description': 'Final state when the settlement is not possible.'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('settlementState').insert(settlementStates)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading seeds for settlementState has failed with the following error: ${err}`)
      return -1000
    }
  }
}
