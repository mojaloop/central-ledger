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
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Valentin Genev <valentin.genev@modusbox.com>
 - Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 - Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/

'use strict'

const Model = require('../../../src/domain/participant')
const ParticipantCurrencyModel = require('../../../src/models/participant/participantCurrency')
const time = require('@mojaloop/central-services-shared').Util.Time
const Enum = require('@mojaloop/central-services-shared').Enum
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const testParticipant = {
  name: 'fsp',
  currency: 'USD',
  isDisabled: 0,
  createdDate: new Date()
}

exports.prepareData = async (name, currencyId = 'USD', isUnique = true) => {
  try {
    const participantId = await Model.create(Object.assign(
      {},
      testParticipant,
      {
        name: (name || testParticipant.name) + (isUnique ? time.msToday().toString() : '')
      }
    ))
    const participantCurrencyId = await ParticipantCurrencyModel.create(participantId, currencyId, Enum.Accounts.LedgerAccountType.POSITION, false)
    const participantCurrencyId2 = await ParticipantCurrencyModel.create(participantId, currencyId, Enum.Accounts.LedgerAccountType.SETTLEMENT, false)
    const participant = await Model.getById(participantId)
    return {
      participant,
      participantCurrencyId,
      participantCurrencyId2
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

exports.deletePreparedData = async (participantName) => {
  if (!participantName) {
    throw new Error('Please provide a valid participant name!')
  }

  try {
    return await Model.destroyByName(participantName)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
