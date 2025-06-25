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

 * Infitx
 - Steven Oderayi <steven.oderayi@infitx.com>

 --------------

 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const LockInterface = require('../../../../src/lib/distLock/lock')

Test('LockInterface test', async (lockTest) => {
  lockTest.test('should throw error when instantiated directly', (test) => {
    try {
      const obj = new LockInterface()
      console.log(obj)
      test.fail('Expected error not thrown')
    } catch (error) {
      test.equal(error.message, 'Cannot construct LockInterface instances directly')
      test.end()
    }
  })

  lockTest.test('should implement acquire method', (test) => {
    class TestLockImpl extends LockInterface {
      release () {}
      extend () {}
    }
    test.throws(() => new TestLockImpl(), /Class must implement method: "acquire"/)
    test.end()
  })

  lockTest.test('should implement release method', (test) => {
    class TestLockImpl extends LockInterface {
      acquire () {}
      extend () {}
    }
    test.throws(() => new TestLockImpl(), /Class must implement method: "release"/)
    test.end()
  })

  lockTest.test('should implement extend method', (test) => {
    class TestLockImpl extends LockInterface {
      acquire () {}
      release () {}
    }
    test.throws(() => new TestLockImpl(), /Class must implement method: "extend"/)
    test.end()
  })

  lockTest.end()
})
