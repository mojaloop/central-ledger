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
 * Valentin Genev <valentin.genev@modusbox.com>
 * Deon Botha <deon.botha@modusbox.com>
 --------------
 ******/

'use strict'

const Db = require('../../lib/db')

const getAccountInSettlement = async ({ settlementId, accountId }) => {
  const result = await Db.from('settlementParticipantCurrency').query(builder => {
    return builder
      .select('settlementParticipantCurrencyId')
      .where({ settlementId })
      .andWhere('participantCurrencyId', accountId)
      .first()
  })
  return result
}

const getBySettlementAndAccount = async (settlementId, accountId) => {
  const result = await Db.from('settlementParticipantCurrency').query(builder => {
    return builder
      .innerJoin('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'settlementParticipantCurrency.currentStateChangeId')
      .select('settlementParticipantCurrency.*', 'spcsc.settlementStateId', 'spcsc.reason', 'spcsc.externalReference')
      .where({ settlementId })
      .andWhere('participantCurrencyId', accountId)
      .first()
  })
  return result
}

const getParticipantCurrencyBySettlementId = async ({ settlementId }) => {
  return Db.from('settlementParticipantCurrency').query(builder => {
    return builder
      .leftJoin('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'settlementParticipantCurrency.currentStateChangeId')
      .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'settlementParticipantCurrency.participantCurrencyId')
      .select(
        'pc.participantId AS id',
        'settlementParticipantCurrency.participantCurrencyId AS participantCurrencyId',
        'spcsc.settlementStateId AS state',
        'spcsc.reason AS reason',
        'settlementParticipantCurrency.netAmount AS netAmount',
        'pc.currencyId AS currency',
        'settlementParticipantCurrency.settlementParticipantCurrencyId AS key'
      )
      .where({ settlementId })
  })
}

const getAccountsInSettlementByIds = async ({ settlementId, participantId }) => {
  return Db.from('settlementParticipantCurrency').query(builder => {
    return builder
      .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'settlementParticipantCurrency.participantCurrencyId')
      .select('settlementParticipantCurrencyId')
      .where({ settlementId })
      .andWhere('pc.participantId', participantId)
  })
}

const getSettlementAccountsByListOfIds = async (settlementParticipantCurrencyIdList) => {
  return Db.from('settlementParticipantCurrency').query(builder => {
    return builder
      .join('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'settlementParticipantCurrency.currentStateChangeId')
      .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'settlementParticipantCurrency.participantCurrencyId')
      .select(
        'pc.participantId AS id',
        'settlementParticipantCurrency.participantCurrencyId',
        'spcsc.settlementStateId AS state',
        'spcsc.reason AS reason',
        'settlementParticipantCurrency.netAmount as netAmount',
        'pc.currencyId AS currency'
      )
      .whereIn('settlementParticipantCurrency.settlementParticipantCurrencyId', settlementParticipantCurrencyIdList)
  })
}

const getSettlementAccountById = async (settlementParticipantCurrencyId) => {
  return Db.from('settlementParticipantCurrency').query(builder => {
    return builder
      .join('settlementParticipantCurrencyStateChange AS spcsc', 'spcsc.settlementParticipantCurrencyStateChangeId', 'settlementParticipantCurrency.currentStateChangeId')
      .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'settlementParticipantCurrency.participantCurrencyId')
      .select(
        'pc.participantId AS id',
        'settlementParticipantCurrency.participantCurrencyId',
        'spcsc.settlementStateId AS state',
        'spcsc.reason AS reason',
        'settlementParticipantCurrency.netAmount as netAmount',
        'pc.currencyId AS currency'
      )
      .where('settlementParticipantCurrency.settlementParticipantCurrencyId', settlementParticipantCurrencyId)
  })
}

module.exports = {
  getAccountInSettlement,
  getAccountsInSettlementByIds,
  getBySettlementAndAccount,
  getParticipantCurrencyBySettlementId,
  getSettlementAccountsByListOfIds,
  getSettlementAccountById,
}
