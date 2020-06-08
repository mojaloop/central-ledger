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

 * ModusBox
 - Lazola Lucas <lazola.lucas@modusbox.com>
 --------------
 ******/
'use strict'

// import { currencyList } from '../../../seeds/currency'
// import { ledgerEntryList } from '../../../seeds/ledgerEntryType'

const Handler = require('./handler')
const Joi = require('@hapi/joi')

const tags = ['api', 'ledger']

module.exports = [
  {
    method: 'POST',
    path: '/ledgerEntry',
    handler: Handler.create,
    options: {
      tags,
      validate: {
        payload: Joi.object({
          transferId: Joi.string().guid().required(),
          payeeParticipantName: Joi.string().required().description('Payee Participant name'),
          payerParticipantName: Joi.string().required().description('Payer Participant name'),
          amount: Joi.object({
            amount: Joi.number().positive().precision(4).required(),
            currency: Joi.string().required().description('Currency code')
          }),
          ledgerEntryType: Joi.string().required().description('ledger entry type ')
        }
        )
      }
    }
  }
]
