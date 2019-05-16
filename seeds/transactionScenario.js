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

const transactionScenario = [
  {
    'name': 'TRANSFER',
    'description': 'Used for performing a P2P (Peer to Peer, or Consumer to Consumer) transaction'
  },
  {
    'name': 'DEPOSIT_NOT_SUPPORTED',
    'description': 'Used for performing a Cash-In (deposit) transaction. In a normal scenario, electronic funds are transferred from a Business account to a Consumer account, and physical cash is given from the Consumer to the Business User'
  },
  {
    'name': 'WITHDRAWAL_NOT_SUPPORTED',
    'description': 'Used for performing a Cash-Out (withdrawal) transaction. In a normal scenario, electronic funds are transferred from a Consumer’s account to a Business account, and physical cash is given from the Business User to the Consumer'
  },
  {
    'name': 'PAYMENT_NOT_SUPPORTED',
    'description': 'Usually used for performing a transaction from a Consumer to a Merchant or Organization, but could also be for a B2B (Business to Business) payment. The transaction could be online for a purchase in an Internet store, in a physical store where both the Consumer and Business User are present, a bill payment, a donation, and so on'
  },
  {
    'name': 'REFUND_NOT_SUPPORTED',
    'description': 'Used for performing a refund of transaction'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('transactionScenario').insert(transactionScenario)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading seeds for transactionScenario has failed with the following error: ${err}`)
      return -1000
    }
  }
}
