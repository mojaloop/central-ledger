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
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Model = require('../../../../src/models/ledgerAccountType/ledgerAccountType')

Test('ledgerAccountType model', async (ledgerAccountTypeTest) => {
  let sandbox

  const ledgerAccountType = {
    name: 'HUB_SETTLEMENT',
    description: 'A single account for each currency with which the hub operates. The account is "held" by the Participant representing the hub in the switch',
    isActive: 1,
    createdDate: new Date()
  }

  ledgerAccountTypeTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.ledgerAccountType = {
      findOne: sandbox.stub(),
      destroy: sandbox.stub()
    }
    t.end()
  })

  ledgerAccountTypeTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await ledgerAccountTypeTest.test('get a ledger account type', async (assert) => {
    try {
      const ledgerTypeName = {name: 'HUB_SETTLEMENT'}
      Db.ledgerAccountType.findOne.withArgs({name: ledgerTypeName.name}).returns(ledgerAccountType)
      let type = await Model.getByName('HUB_SETTLEMENT')
      assert.equal(JSON.stringify(type), JSON.stringify(ledgerAccountType))
      assert.end()
    } catch (err) {
      assert.fail()
      assert.end()
    }
  })

  await ledgerAccountTypeTest.test('catch error thrown', async (assert) => {
    try {
      Db.ledgerAccountType.findOne.throws(new Error())
      await Model.getByName('HUB_SETTLEMENT')
      assert.fail('Error should be caught')
      assert.end()
    } catch (err) {
      assert.pass()
      assert.end()
    }
  })

  await ledgerAccountTypeTest.end()
})
