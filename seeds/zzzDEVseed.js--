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

const createdBy = 'zzzDEVseed'
const createdDate = new Date()

const participants = [
  {
    'name': 'dfsp1',
    createdDate,
    createdBy
  },
  {
    'name': 'dfsp2',
    createdDate,
    createdBy
  }
]

const participantCurrencies = [
  {
    'participantId': 1,
    'currencyId': 'USD',
    createdDate,
    createdBy
  },
  {
    'participantId': 1,
    'currencyId': 'EUR',
    createdDate,
    createdBy
  },
  {
    'participantId': 2,
    'currencyId': 'USD',
    createdDate,
    createdBy
  }
]

const participantLimits = [
  {
    'participantCurrencyId': 1,
    'participantLimitTypeId': 1,
    'value': 1000,
    createdDate,
    createdBy
  },
  {
    'participantCurrencyId': 2,
    'participantLimitTypeId': 1,
    'value': 1000,
    createdDate,
    createdBy
  },
  {
    'participantCurrencyId': 3,
    'participantLimitTypeId': 1,
    'value': 1000,
    createdDate,
    createdBy
  }
]

const participantPositions = [
  {
    'participantCurrencyId': 1,
    'value': 100,
    'reservedValue': 0,
    changedDate: createdDate
  },
  {
    'participantCurrencyId': 2,
    'value': 100,
    'reservedValue': 0,
    changedDate: createdDate
  },
  {
    'participantCurrencyId': 3,
    'value': 500,
    'reservedValue': 0,
    changedDate: createdDate
  }
]
exports.seed = async function (knex) {
  try {
    await knex('participant').insert(participants)
    await knex('participantCurrency').insert(participantCurrencies)
    await knex('participantLimit').insert(participantLimits)
    await knex('participantPosition').insert(participantPositions)
    return true
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading development seeds has failed with the following error: ${err}`)
      return -1000
    }
  }
}
