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
 * Lazola Lucas <lazola.lucas@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const ledgerAccountTypes = [
  {
    name: 'POSITION',
    description: 'Typical accounts from which a DFSP provisions transfers',
    isSettleable: 1
  },
  {
    name: 'SETTLEMENT',
    description: 'Reflects the individual DFSP Settlement Accounts as held at the Settlement Bank'
  },
  {
    name: 'HUB_RECONCILIATION',
    description: 'A single account for each currency with which the hub operates. The account is "held" by the Participant representing the hub in the switch'
  },
  {
    name: 'HUB_MULTILATERAL_SETTLEMENT',
    description: 'A single account for each currency with which the hub operates. The account is "held" by the Participant representing the hub in the switch'
  },
  {
    name: 'INTERCHANGE_FEE',
    description: null,
    isSettleable: 1
  },
  {
    name: 'INTERCHANGE_FEE_SETTLEMENT',
    description: null
  }
]

const ledgerAccountList = ledgerAccountTypes.filter(currentValue => {
  return currentValue.isSettleable
}).map(currentValue => {
  return currentValue.name
}).sort()

const seed = async function (knex) {
  try {
    return await knex('ledgerAccountType').insert(ledgerAccountTypes).onConflict('name').ignore()
  } catch (err) {
    console.log(`Uploading seeds for ledgerAccountType has failed with the following error: ${err}`)
    return -1000
  }
}

module.exports = {
  ledgerAccountList,
  seed
}
