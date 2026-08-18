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
 --------------
 ******/

'use strict'

const bulkProcessingStates = [
  {
    bulkProcessingStateId: 1,
    name: 'RECEIVED',
    description: 'The switch has received the individual transfer ids part of the bulk transfer'
  },
  {
    bulkProcessingStateId: 2,
    name: 'RECEIVED_DUPLICATE',
    description: 'The switch has matched individual transfer as duplicate'
  },
  {
    bulkProcessingStateId: 3,
    name: 'RECEIVED_INVALID',
    description: 'The switch has matched individual transfer as invalid within Prepare or Position Handler'
  },
  {
    bulkProcessingStateId: 4,
    name: 'ACCEPTED',
    description: 'The switch has reserved the funds for the transfers in the bulk'
  },
  {
    bulkProcessingStateId: 5,
    name: 'PROCESSING',
    description: 'Fulfilment request has been received for the individual transfer'
  },
  {
    bulkProcessingStateId: 6,
    name: 'FULFIL_DUPLICATE',
    description: 'The switch has matched individual transfer fulfil as duplicate'
  },
  {
    bulkProcessingStateId: 7,
    name: 'FULFIL_INVALID',
    description: 'The switch has matched individual transfer fulfilment as invalid within Fulfil or Position Handler'
  },
  {
    bulkProcessingStateId: 8,
    name: 'COMPLETED',
    description: 'The switch has marked the individual transfer as committed'
  },
  {
    bulkProcessingStateId: 9,
    name: 'REJECTED',
    description: 'The switch has marked the individual transfer as rejected'
  },
  {
    bulkProcessingStateId: 10,
    name: 'EXPIRED',
    description: 'The switch has marked the individual transfer as timed out'
  },
  {
    bulkProcessingStateId: 11,
    name: 'ABORTING',
    description: 'The switch has marked the individual transfer as aborting due to failed validation'
  }
]

exports.seed = async function (knex) {
  try {
    return await knex('bulkProcessingState').insert(bulkProcessingStates).onConflict('name').ignore()
  } catch (err) {
    console.log(`Uploading seeds for bulkProcessingState has failed with the following error: ${err}`)
    return -1000
  }
}
