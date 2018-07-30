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

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Logger = require('@mojaloop/central-services-shared').Logger
const Model = require('../../../../src/domain/position/positionCalculator')

Test('Position calculator', async (positionCalculatorTest) => {
  let sandbox

  positionCalculatorTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    t.end()
  })

  positionCalculatorTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await positionCalculatorTest.test('sum should', async (test) => {
    let position1 = {
      payments: 10,
      receipts: 10,
      net: 10
    }
    let position2 = {
      payments: 5,
      receipts: 5,
      net: 5
    }
    let sumResult = {
      payments: 15,
      receipts: 15,
      net: 15
    }

    try {
      const result = await Model.sum(position1, position2)
      test.deepEqual(result, sumResult, 'correctly sum up positions')
      test.end()
    } catch (err) {
      Logger.error(`currency seed failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await positionCalculatorTest.end()
})
