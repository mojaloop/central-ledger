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

 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
// const Logger = require('@mojaloop/central-services-shared').Logger
const Error = require('../../../src/errors')

Test('Test Errors', async (errorsTest) => {
  let sandbox

  errorsTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    t.end()
  })

  errorsTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await errorsTest.test('should throw AlreadyRolledBackError', async (test) => {
    try {
      throw new Error.AlreadyRolledBackError()
    } catch (err) {
      test.ok(err instanceof Error.AlreadyRolledBackError)
      test.end()
    }
  })

  await errorsTest.test('should throw ExpiredTransferError', async (test) => {
    try {
      throw new Error.ExpiredTransferError()
    } catch (err) {
      test.ok(err instanceof Error.ExpiredTransferError)
      test.end()
    }
  })

  await errorsTest.test('should throw InvalidBodyError', async (test) => {
    try {
      throw new Error.InvalidBodyError()
    } catch (err) {
      test.ok(err instanceof Error.InvalidBodyError)
      test.end()
    }
  })

  await errorsTest.test('should throw InvalidModificationError', async (test) => {
    try {
      throw new Error.InvalidModificationError()
    } catch (err) {
      test.ok(err instanceof Error.InvalidModificationError)
      test.end()
    }
  })

  await errorsTest.test('should throw UnauthorizedError', async (test) => {
    try {
      throw new Error.UnauthorizedError()
    } catch (err) {
      test.ok(err instanceof Error.UnauthorizedError)
      test.end()
    }
  })

  await errorsTest.test('should throw UnmetConditionError', async (test) => {
    try {
      throw new Error.UnmetConditionError()
    } catch (err) {
      test.ok(err instanceof Error.UnmetConditionError)
      test.end()
    }
  })

  await errorsTest.test('should throw UnpreparedTransferError', async (test) => {
    try {
      throw new Error.UnpreparedTransferError()
    } catch (err) {
      test.ok(err instanceof Error.UnpreparedTransferError)
      test.end()
    }
  })

  await errorsTest.end()
})
