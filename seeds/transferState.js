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

const transferStates = [
  {
    transferStateId: 'RECEIVED_PREPARE',
    enumeration: 'RECEIVED',
    description: 'The switch has received the transfer.'
  },
  {
    transferStateId: 'RESERVED',
    enumeration: 'RESERVED',
    description: 'The switch has reserved the transfer.'
  },
  {
    transferStateId: 'RECEIVED_FULFIL',
    enumeration: 'RESERVED',
    description: 'The switch has reserved the transfer, and has been assigned to a settlement window.'
  },
  {
    transferStateId: 'COMMITTED',
    enumeration: 'COMMITTED',
    description: 'The switch has successfully performed the transfer.'
  },
  {
    transferStateId: 'FAILED',
    enumeration: 'ABORTED',
    description: 'Aborted the transfer due to failure to perform the transfer.'
  },
  {
    transferStateId: 'RESERVED_TIMEOUT',
    enumeration: 'RESERVED',
    description: 'Expiring the transfer and returning funds to payer fsp.'
  },
  {
    transferStateId: 'RECEIVED_REJECT',
    enumeration: 'RESERVED',
    description: 'The switch has received a transfer abort from payee fsp.'
  },
  {
    transferStateId: 'ABORTED_REJECTED',
    enumeration: 'ABORTED',
    description: 'The switch has aborted a transfer due to being RECEIVED_REJECT.'
  },
  {
    transferStateId: 'RECEIVED_ERROR',
    enumeration: 'RESERVED',
    description: 'The switch has received a transfer error callback'
  },
  {
    transferStateId: 'ABORTED_ERROR',
    enumeration: 'ABORTED',
    description: 'The switch has aborted a transfer due to being RECEIVED_ERROR'
  },
  {
    transferStateId: 'EXPIRED_PREPARED',
    enumeration: 'ABORTED',
    description: 'The switch has aborted the transfer due to being EXPIRED transfer from RECEIVED_PREPARE.'
  },
  {
    transferStateId: 'EXPIRED_RESERVED',
    enumeration: 'ABORTED',
    description: 'The switch has aborted the transfer due to being EXPIRED transfer from RESERVED.'
  },
  {
    transferStateId: 'INVALID',
    enumeration: 'ABORTED',
    description: 'The switch has aborted the transfer due to validation failure.'
  },
  {
    transferStateId: 'SETTLED',
    enumeration: 'SETTLED',
    description: 'The switch has settled the transfer.'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('transferState').insert(transferStates).onConflict('transferStateId').ignore()
  } catch (err) {
    console.log(`Uploading seeds for transferState has failed with the following error: ${err}`)
    return -1000
  }
}
