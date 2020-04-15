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
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Logger = require('@mojaloop/central-services-logger')
const NullClient = require(`${src}/lib/sidecar/nullClient`)

Test('Null SidecarClient', nullSidecarTest => {
  let sandbox

  nullSidecarTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Logger)
    sandbox.stub(Logger, 'isDebugEnabled').value(true)
    t.end()
  })

  nullSidecarTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  nullSidecarTest.test('create should', createTest => {
    createTest.test('create new null client', test => {
      const client = NullClient.create()
      test.ok(client)
      test.end()
    })

    createTest.end()
  })

  nullSidecarTest.test('connect should', connectTest => {
    connectTest.test('log and return resolved promise immediately', test => {
      const client = NullClient.create()

      client.connect()
        .then(() => {
          test.ok(Logger.debug.calledWith('Sidecar disabled: connecting in NullClient'))
          test.end()
        })
    })

    connectTest.end()
  })

  nullSidecarTest.test('write should', writeTest => {
    writeTest.test('log message', test => {
      const client = NullClient.create()

      const msg = 'This is a test'
      client.write(msg)
      test.ok(Logger.debug.calledWith(`Sidecar disabled: writing message ${msg} in NullClient`))
      test.end()
    })

    writeTest.end()
  })

  nullSidecarTest.end()
})
