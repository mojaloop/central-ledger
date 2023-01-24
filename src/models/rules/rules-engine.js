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

const { Engine } = require('json-rules-engine')
const Logger = require('@mojaloop/central-services-logger')

class RulesEngine {
  constructor (config) {
    this.config = config
    this.init()
  }

  static events = {
    SELECT_SETTLEMENT_MODEL: 'SELECT_SETTLEMENT_MODEL'
  }

  init () {
    this.engine = new Engine()
    this._addCustomOperators()
  }

  _addCustomOperators () {
  }

  /**
  * Loads an array of rules into the engine
  *
  * @param {object[]} rules - an array of rules to load into the engine
  * @returns {undefined}
  */
  loadRules (rules) {
    try {
      this.init()
      const rulesLength = rules.length
      rules.forEach((r, index) => {
        r.priority = rulesLength - index
        this.engine.addRule(r)
      })
    } catch (err) {
      Logger.isErrorEnabled && Logger.error(err)
      throw err
    }
  }

  /**
  * Runs the engine to evaluate facts
  *
  * @async
  * @param {Object} facts facts to evalute
  * @returns {Promise.<Object>} response
  */
  async evaluate (facts) {
    return new Promise((resolve, reject) => {
      this.engine
        .run(facts)
        .then((events) => {
          return resolve(events.events.length === 0 ? null : events.events)
        }).catch(reject)
    })
  }
}

module.exports = RulesEngine
