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

 * Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 ******/

const RulesEngine = require('./rules-engine')
const rules = require('../../../config/rules-settlement-model.json')

class SettlementModelRulesEngine {
  constructor (config) {
    this.config = config
    this.engine = new RulesEngine(config)
    this.engine.loadRules(rules)
  }

  async obtainSettlementModelFrom (
    transactionObject,
    settlementModels,
    ledgerAccountTypes
  ) {
    const facts = {
      transaction: transactionObject,
      settlementModels
    }
    const events = await this.engine.evaluate(facts)
    let selectedSettlementModel = null
    if (events && events.length > 0 && events[0].type === 'SELECT_SETTLEMENT_MODEL') {
      if (
        events[0].params.ledgerAccountType && events[0].params.settlementAccountType &&
        ledgerAccountTypes[events[0].params.ledgerAccountType] && ledgerAccountTypes[events[0].params.settlementAccountType]
      ) {
        selectedSettlementModel = settlementModels.find(sm => (sm.ledgerAccountTypeId === ledgerAccountTypes[events[0].params.ledgerAccountType] && sm.settlementAccountTypeId === ledgerAccountTypes[events[0].params.settlementAccountType]))
        if (!selectedSettlementModel) {
          throw (new Error(`SettlementModel not found with ledgerAccountType = ${events[0].params.settlementAccountType} and settlementAccountType = ${events[0].params.settlementAccountType}`))
        }
      } else {
        throw (new Error('Incorrect rule. Specify params ledgerAccountType and settlementAccountType'))
      }
    } else {
      selectedSettlementModel = settlementModels.find(sm => (sm.ledgerAccountType === ledgerAccountTypes.POSITION && sm.settlementAccountType === ledgerAccountTypes.SETTLEMENT))
    }
    return selectedSettlementModel
  }
}

module.exports = SettlementModelRulesEngine
