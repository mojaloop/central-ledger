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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const ledgerEntryTypes = [
  {
    name: 'PRINCIPLE_VALUE',
    description: 'The principle amount to be settled between parties, derived on quotes between DFSPs',
    ledgerAccountTypeId: 1 // POSITION
  },
  {
    name: 'INTERCHANGE_FEE',
    description: 'Fees to be paid between DFSP',
    ledgerAccountTypeId: 5 // INTERCHANGE_FEE
  },
  {
    name: 'HUB_FEE',
    description: 'Fees to be paid from the DFSPs to the Hub Operator'
  },
  {
    name: 'POSITION_DEPOSIT',
    description: 'Used when increasing Net Debit Cap'
  },
  {
    name: 'POSITION_WITHDRAWAL',
    description: 'Used when decreasing Net Debit Cap'
  },
  {
    name: 'SETTLEMENT_NET_RECIPIENT',
    description: 'Participant is settlement net recipient'
  },
  {
    name: 'SETTLEMENT_NET_SENDER',
    description: 'Participant is settlement net sender'
  },
  {
    name: 'SETTLEMENT_NET_ZERO',
    description: 'Participant is settlement net sender'
  },
  {
    name: 'RECORD_FUNDS_IN',
    description: 'Settlement account funds in'
  },
  {
    name: 'RECORD_FUNDS_OUT',
    description: 'Settlement account funds out'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('ledgerEntryType').insert(ledgerEntryTypes).onConflict('name').ignore()
  } catch (err) {
    console.log(`Uploading seeds for ledgerEntryType has failed with the following error: ${err}`)
    return -1000
  }
}
