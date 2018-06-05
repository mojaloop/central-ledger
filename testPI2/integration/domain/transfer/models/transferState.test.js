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
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const Logger = require('@mojaloop/central-services-shared').Logger
const Db = require('../../../../../src/db/index')
const Config = require('../../../../../src/lib/config')
const Model = require('../../../../../src/domain/transfer/models/transferStates')
const _ = require('lodash')

Test('transferState Model Test', async (transferStateTest) => {
  let sandbox

  const transferTestStates = [
    {
      'transferStateId': 'TEST_RECEIVED',
      'enumeration': 'RECEIVED',
      'description': 'Next ledger has received the transfer.'
    },
    {
      'transferStateId': 'TEST_RESERVED',
      'enumeration': 'RESERVED',
      'description': 'Next ledger has reserved the transfer.'
    },
    {
      'transferStateId': 'TEST_COMMITTED',
      'enumeration': 'COMMITTED',
      'description': 'Next ledger has successfully performed the transfer.'
    },
    {
      'transferStateId': 'TEST_ABORTED',
      'enumeration': 'ABORTED',
      'description': 'Next ledger has aborted the transfer due a rejection or failure to perform the transfer.'
    },
    {
      'transferStateId': 'TEST_SETTLED',
      'enumeration': 'SETTLED',
      'description': 'Ledger has settled the transfer'
    }
  ]

  const transferTestStatesMap = transferTestStates.reduce((map, obj) => {
    map[obj.transferStateId] = obj
    return map
  }, {})

  await transferStateTest.test('setup', async (assert) => {
    try {
      sandbox = Sinon.sandbox.create()
      await Db.connect(Config.DATABASE_URI)
      for (let state of transferTestStates) {
        var result = await Model.getByTransferStateId(state.transferStateId)
        if (result) {
          await Model.destroyTransferStatesById(state.transferStateId)
        }
      }
      assert.pass()
      assert.end()
    } catch (err) {
      Logger.error(`setup failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transferStateTest.test('saveTransferState List', async (assert) => {
    try {
      assert.plan(transferTestStates.length)
      transferTestStates.forEach(async state => {
        var result = await Model.saveTransferState(state)
        assert.ok(Sinon.match(result, true))
      })
    } catch (err) {
      Logger.error(`saveTransferState failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transferStateTest.test('getByTransferStateId', async (assert) => {
    try {
      assert.plan(transferTestStates.length)

      transferTestStates.forEach(async state => {
        var result = await Model.getByTransferStateId(state.transferStateId)
        assert.ok(Sinon.match(result, transferTestStatesMap[result.transferStateId]), `${result.transferStateId} transferState results match`)
      })
    } catch (err) {
      Logger.error(`getByTransferStateId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transferStateTest.test('getAll', async (assert) => {
    try {
      assert.plan(transferTestStates.length)

      const transferStateList = await Model.getAll()
      if (Array.isArray(transferStateList)) {
        const similarTransferStateList = await _.intersectionBy(transferStateList, transferTestStates, 'transferStateId')
        similarTransferStateList.forEach(state => {
          assert.ok(Sinon.match(state, transferTestStatesMap[state.transferStateId]), `${state.transferStateId} transferState results match`)
        })
      } else {
        assert.fail()
        assert.end()
      }
    } catch (err) {
      Logger.error(`getAll failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transferStateTest.test('destroyTransferStatesById', async (assert) => {
    try {
      assert.plan(transferTestStates.length)
      for (let state of transferTestStates) {
        var result = await Model.destroyTransferStatesById(state.transferStateId)
        assert.ok(Sinon.match(result, true))
      }
    } catch (err) {
      Logger.error(`destroyTransferStatesById failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await transferStateTest.test('teardown', async (assert) => {
    try {
      // Model.destroyTransferStates() // falls over when this is executed
      await Db.disconnect()
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`teardown failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })
})
