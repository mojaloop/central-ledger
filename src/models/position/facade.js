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

 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/

'use strict'

const Db = require('../../db')

const getParticipantPositionByParticipantIdAndCurrencyId = async (participantId, currencyId) => {
  try {
    return await Db.participant.query(async (builder) => {
      return await builder
        .where({
          'participant.participantId': participantId,
          'pc.currencyId': currencyId
        })
        .innerJoin('participantCurrency AS pc', 'pc.participantId', 'participant.participantId')
        .innerJoin('participantPosition AS pp', 'pp.participantCurrencyId', 'pc.participantCurrencyId')
        .select(
          'participant.*',
          'pc.*',
          'pp.*'
        )
    })
  } catch (e) {
    throw e
  }
}

const getParticipantLimitByParticipantIdAndCurrencyId = async (participantId, currencyId) => {
  try {
    return await Db.participant.query(async (builder) => {
      return await builder
        .where({
          'participant.participantId': participantId,
          'pc.currencyId': currencyId
        })
        .innerJoin('participantCurrency AS pc', 'pc.participantId', 'participant.participantId')
        .innerJoin('participantLimit AS pl', 'pl.participantCurrencyId', 'pl.participantCurrencyId')
        .select(
          'participant.*',
          'pc.*',
          'pl.*'
        )
    })
  } catch (e) {
    throw e
  }
}

module.exports = {
  getParticipantPositionByParticipantIdAndCurrencyId,
  getParticipantLimitByParticipantIdAndCurrencyId
}
