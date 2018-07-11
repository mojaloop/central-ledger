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

const Test = require('tape')
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
const Model = require('../../../../src/models/participant/facade')

Test('Participant facade', async (facadeTest) => {
  let sandbox

  const participant = {
    name: 'fsp1',
    currency: 'USD',
    isActive: 1,
    createdDate: new Date(),
    createdBy: 'unknown',
    participantCurrencyId: 1
  }

  sandbox = Sinon.createSandbox()
  Db.participant = {
    query: sandbox.stub()
  }

  await facadeTest.test('getByNameAndCurrency', async (assert) => {
    try {
      Db.participant.query.returns(participant)
      var result = await Model.getByNameAndCurrency({ name: 'fsp1', currencyId: 'USD' })
      assert.deepEqual(result, participant)
      assert.end()
    } catch (err) {
      Logger.error(`getByNameAndCurrency failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getByNameAndCurrency should throw error', async (assert) => {
    try {
      Db.participant.query.throws(new Error('message'))
      await Model.getByNameAndCurrency({ name: 'fsp1', currencyId: 'USD' })
      assert.fail(' should throw')
      assert.end()
    } catch (err) {
      Logger.error(`getByNameAndCurrency failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('getByNameAndCurrency should throw error when participant not found', async (assert) => {
    try {
      Db.participant.query.throws(new Error('message'))
      await Model.getByNameAndCurrency({ name: 'fsp3', currencyId: 'USD' })
      assert.fail(' should throw')
      assert.end()
    } catch (err) {
      Logger.error(`getByNameAndCurrency failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.end()
})
