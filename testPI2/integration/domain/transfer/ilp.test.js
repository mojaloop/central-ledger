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
 * Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../../src/lib/config')
const Model = require('../../../../src/domain/transfer/models/ilp-model')
const Service = require('../../../../src/domain/transfer/ilp')
const TransferModel = require('../../../../src/domain/transfer/index')

Test('Ilp service', async (ilpTest) => {
  let sandbox

  let ilpTestValues = [
    {
      transferId: '1',
      packet: 'test packet',
      condition: 'test condition',
      fulfillment: 'test fulfillment'
    }
  ]

  let ilpMap = new Map()

  await ilpTest.test('setup', async (assert) => {
    try {
      sandbox = Sinon.sandbox.create()
    //   sandbox.stub(TransferModel, 'create')
    //   sandbox.stub(TransferModel, 'getById')

    //   Db.transfer = {
    //     insert: sandbox.stub(),
    //     update: sandbox.stub(),
    //     findOne: sandbox.stub(),
    //     find: sandbox.stub()
    //   }

      await Db.connect(Config.DATABASE_URI).then(() => {
        assert.pass('setup OK')
        assert.end()
      }).catch(err => {
        Logger.error(`Connecting to database - ${err}`)
        assert.fail(`Connecting to database - ${err}`)
        assert.end()
      })
    } catch (err) {
      Logger.error(`Setup for test failed with error - ${err}`)
      assert.fail(`Setup for test failed with error - ${err}`)
      assert.end()
    }
  })

  await ilpTest.test('create ilp', async (assert) => {
    try {
      assert.plan(ilpTestValues.length)
      ilpTestValues.forEach(async ilp => {
        try {
          let result = await Service.create({
            transferId: ilp.transferId,
            packet: ilp.packet,
            condition: ilp.condition,
            fulfillment: ilp.fulfillment
          })

          let read = await Service.getByTransferId(ilp.transferId)

          ilpMap.set(result, read)

          assert.comment(`Testing with participant \n ${JSON.stringify(ilp, null, 2)}`)
          assert.equal(read.transferId, ilp.transferId, ' transferId match')
          assert.equal(read.packet, ilp.packet, ' packet match')
          assert.equal(read.condition, ilp.condition, ' condition match')
          assert.equal(read.fulfillment, ilp.fulfillment, ' fulfillment match')
        } catch (err) {
          Logger.error(`create 1 ilp failed with error - ${err}`)
          assert.fail(`Create 1 ilp failed - ${err}`)
          assert.end()
        }
      })
    } catch (err) {
      Logger.error(`create all ilp objects failed with error - ${err}`)
      assert.fail(`Create all ilp objects failed - ${err}`)
      assert.end()
    }
  })

  await ilpTest.test('create ilp without transferId should throw error', async (assert) => {
    try {
      assert.plan(1)
      await Service.create({
        packet: 'test packet',
        condition: 'test condition',
        fulfillment: 'test fulfillment'
      })
    } catch (err) {
      Logger.error('create ilp without transferId is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
    }
  })

  await ilpTest.test('create ilp without packet should throw error', async (assert) => {
    try {
      assert.plan(1)
      await Service.create({
        transferId: '10',
        condition: 'test condition',
        fulfillment: 'test fulfillment'
      })
    } catch (err) {
      Logger.error('create ilp without packet is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
    }
  })

  await ilpTest.test('create ilp without condition should throw error', async (assert) => {
    try {
      assert.plan(1)
      await Service.create({
        transferId: '10',
        packet: 'test packet',
        fulfillment: 'test fulfillment'
      })
    } catch (err) {
      Logger.error('create ilp without condition is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
    }
  })

  await ilpTest.test('getByTransferId', async (assert) => {
    try {
      for (let ilpId of ilpMap.keys()) {
        let ilp = await Service.getByTransferId(ilpMap.get(ilpId).transferId)
        assert.equal(JSON.stringify(ilp), JSON.stringify(ilpMap.get(ilpId)))
      }
      assert.end()
    } catch (err) {
      Logger.error(`get ilp by transferId failed with error - ${err}`)
      assert.fail(`Get ilp by transferId failed - ${err}`)
      assert.end()
    }
  })

  await ilpTest.test('update', async (assert) => {
    try {
      for (let ilpId of ilpMap.keys()) {
        let ilp = await Service.update(ilpMap.get(ilpId), { ilpPacket: 'new test packet' })
        let ilpDb = await Service.getByTransferId(ilp.transferId)
        assert.equal(ilp.ilpId, ilpDb.ilpId, ' ids match')
        assert.equal(ilpDb.packet, 'new test packet', 'update is real')
      }
      assert.end()
    } catch (err) {
      Logger.error(`update ilp failed with error - ${err}`)
      assert.fail(`Update ilp failed - ${err}`)
      assert.end()
    }
  })

  await ilpTest.test('teardown', async (assert) => {
    try {
      ilpTestValues.forEach(async (ilp) => {
        await Model.destroyByTransferId(ilp)
      })
      await Db.disconnect()
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`ilp teardown failed with error - ${err}`)
      assert.fail(`Ilp teardown failed - ${err}`)
      assert.end()
    }
  })
})
