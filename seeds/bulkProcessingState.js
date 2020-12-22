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

const bulkProcessingStates = [
  {
    name: 'RECEIVED',
    description: 'The switch has received the individual transfer ids part of the bulk transfer'
  },
  {
    name: 'RECEIVED_DUPLICATE',
    description: 'The switch has matched individual transfer as duplicate'
  },
  {
    name: 'RECEIVED_INVALID',
    description: 'The switch has matched individual transfer as invalid within Prepare or Position Handler'
  },
  {
    name: 'ACCEPTED',
    description: 'The switch has reserved the funds for the transfers in the bulk'
  },
  {
    name: 'PROCESSING',
    description: 'Fulfilment request has been received for the individual transfer'
  },
  {
    name: 'FULFIL_DUPLICATE',
    description: 'The switch has matched individual transfer fulfil as duplicate'
  },
  {
    name: 'FULFIL_INVALID',
    description: 'The switch has matched individual transfer fulfilment as invalid within Fulfil or Position Handler'
  },
  {
    name: 'COMPLETED',
    description: 'The switch has marked the individual transfer as committed'
  },
  {
    name: 'REJECTED',
    description: 'The switch has marked the individual transfer as rejected'
  },
  {
    name: 'EXPIRED',
    description: 'The switch has marked the individual transfer as timed out'
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
