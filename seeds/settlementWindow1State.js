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

const settlementWindowStates = [
  {
    settlementWindowStateId: 'OPEN',
    enumeration: 'OPEN',
    description: 'Current window into which Fulfilled transfers are being allocated. Only one window should be open at a time.'
  },
  {
    settlementWindowStateId: 'CLOSED',
    enumeration: 'CLOSED',
    description: 'Settlement Window is not accepting any additional transfers. All new transfers are being allocated to the OPEN Settlement Window.'
  },
  {
    settlementWindowStateId: 'PENDING_SETTLEMENT',
    enumeration: 'PENDING_SETTLEMENT',
    description: 'The net settlement report for this window has been taken, with the parameter set to indicate that settlement is to be processed.'
  },
  {
    settlementWindowStateId: 'SETTLED',
    enumeration: 'SETTLED',
    description: 'The Hub Operator/Settlement Bank has confirmed that all the participants that engaged in the settlement window have now settled their payments in accordance with the net settlement report.'
  },
  {
    settlementWindowStateId: 'ABORTED',
    enumeration: 'ABORTED',
    description: 'Window returned to this state when the settlement was not possible. This window may now be included in a future settlement.'
  },
  {
    settlementWindowStateId: 'PROCESSING',
    enumeration: 'PROCESSING',
    description: 'Intermediate state when closing a window.'
  },
  {
    settlementWindowStateId: 'FAILED',
    enumeration: 'FAILED',
    description: 'Used when close window processing failed and all retries have been exhausted.'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('settlementWindowState').insert(settlementWindowStates).onConflict('settlementWindowStateId').ignore()
  } catch (err) {
    console.log(`Uploading seeds for settlementWindowState has failed with the following error: ${err}`)
    return -1000
  }
}
