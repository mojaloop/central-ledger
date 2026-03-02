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

 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

/**
 * @module generateInitialSettlementWindow
 * @description Seed to create the initial SettlementWindow
 ***/

const settlementWindowState = 'OPEN'

const initialSettlementWindowReason = 'initial window'

const initialSettlementWindow = {
  reason: initialSettlementWindowReason
}

const initialSettlementWindowStateChange = {
  settlementWindowId: 1,
  settlementWindowStateId: settlementWindowState,
  reason: initialSettlementWindowReason

}

exports.seed = async function (knex) {
  try {
    const settlementWindowStateChangeList = await knex('settlementWindow AS sw').select('*')
      .leftJoin('settlementWindowStateChange AS swsc', 'swsc.settlementWindowStateChangeId', 'sw.currentStateChangeId')
      .where('swsc.settlementWindowStateId', '=', settlementWindowState)
    if (settlementWindowStateChangeList.length < 1) {
      const insertInitialSettlementWindowResult = await knex('settlementWindow').insert(initialSettlementWindow)
      if (!insertInitialSettlementWindowResult || (insertInitialSettlementWindowResult?.length !== 1)) {
        throw Error('insertInitialSettlementWindowResult undefined')
      }
      const settlementWindowId = insertInitialSettlementWindowResult[0]

      initialSettlementWindowStateChange.settlementWindowId = settlementWindowId
      const insertInitialSettlementWindowStateChangeResult = await knex('settlementWindowStateChange').insert(initialSettlementWindowStateChange)
      if (!insertInitialSettlementWindowStateChangeResult || (insertInitialSettlementWindowStateChangeResult?.length !== 1)) {
        throw Error('insertInitialSettlementWindowStateChangeResult undefined')
      }
      const settlementWindowStateChangeId = insertInitialSettlementWindowStateChangeResult[0]

      await knex('settlementWindow')
        .where('settlementWindowId', '=', settlementWindowId)
        .update({
          currentStateChangeId: settlementWindowStateChangeId
        })
    }
    return true
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return -1001
    else {
      console.log(`Uploading seeds for initial settlementWindow has failed with the following error: ${err}`)
      throw err
    }
  }
}
