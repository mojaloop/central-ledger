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
    'settlementStateId': 'PS_TRANSFERS_RECORDED',
    'enumeration': 'PS_TRANSFERS_RECORDED',
    'description': 'Record transfer entries against the Position Account and the Multi-lateral Net Settlement Account, these are the "multi-lateral net  settlement transfers" (MLNS transfers). An identifier might be provided to be past to the reference bank.'
  },
  {
    'settlementStateId': 'PS_TRANSFERS_RESERVED',
    'enumeration': 'PS_TRANSFERS_RESERVED',
    'description': 'All the debit entries for the MLNS transfers are reserved .'
  },
  {
    'settlementStateId': 'PS_TRANSFERS_COMMITTED',
    'enumeration': 'PS_TRANSFERS_COMMITTED',
    'description': 'All the credit entries for the MLNS transfers are committed. An identifier might be received and recorded from the Settlement bank to allow reconciliation.'
  },
  {
    'settlementStateId': 'SETTLING',
    'enumeration': 'SETTLING',
    'description': 'If all accounts are not yet SETTLED, the Status of the settlement is moved to SETTLING. Note: applies only on settlement level.'
  },
  {
    'settlementStateId': 'SETTLED',
    'enumeration': 'SETTLED',
    'description': 'When all outstanding accounts are SETTLED, the entire Settlement is moved to SETTLED.'
  },
  {
    'settlementStateId': 'ABORTED',
    'enumeration': 'ABORTED',
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
