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

const bulkTransferStates = [
  {
    'bulkTransferStateId': 'RECEIVED',
    'enumeration': 'RECEIVED',
    'description': 'The switch has received the bulk transfer'
  },
  {
    'bulkTransferStateId': 'PENDING_PREPARE',
    'enumeration': 'PENDING',
    'description': 'Validation of received bulk transfer is successful'
  },
  {
    'bulkTransferStateId': 'PENDING_INVALID',
    'enumeration': 'PENDING',
    'description': 'Validation of received bulk transfer is not successful'
  },
  {
    'bulkTransferStateId': 'ACCEPTED',
    'enumeration': 'ACCEPTED',
    'description': 'The switch has reserved the funds for the transfers in the bulk'
  },
  {
    'bulkTransferStateId': 'PROCESSING',
    'enumeration': 'PROCESSING',
    'description': 'Fulfilment request has been received by the switch'
  },
  {
    'bulkTransferStateId': 'PENDING_FULFIL',
    'enumeration': 'PROCESSING',
    'description': 'Fulfilment request has been received by the switch'
  },
  {
    'bulkTransferStateId': 'COMPLETED',
    'enumeration': 'COMPLETED',
    'description': 'Final state when transfers in the bulk are committed'
  },
  {
    'bulkTransferStateId': 'REJECTED',
    'enumeration': 'REJECTED',
    'description': 'Final state when the switch has completed rejection request by the payee'
  },
  {
    'bulkTransferStateId': 'INVALID',
    'enumeration': 'REJECTED',
    'description': 'Final state when the switch has completed processing of pending invalid bulk transfer'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('bulkTransferState').insert(bulkTransferStates)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading seeds for bulkTransferState has failed with the following error: ${err}`)
      return -1000
    }
  }
}
