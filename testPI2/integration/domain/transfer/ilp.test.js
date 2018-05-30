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
// const Model = require('../../../../src/domain/transfer/models/ilp-model')
const Service = require('../../../../src/domain/transfer/ilp')
// const TransferModel = require('../../../../src/domain/transfer/index')
const HelperModule = require('../../helpers/index')

Test('Ilp service tests', async (ilpTest) => {
  let sandbox

  let ilpTestValues = [
    {
      transferId: '1',
      packet: 'test packet',
      condition: 'test condition',
      fulfilment: 'test fulfilment'
    }
  ]

  let ilpMap = new Map()

  await ilpTest.test('setup', async (assert) => {
    try {
      sandbox = Sinon.sandbox.create()
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
      ilpTestValues.forEach(async ilp => {
        try {
          let ilpResult = await HelperModule.prepareNeededData('ilp')
          let result = ilpResult.ilp

          let read = await Service.getByTransferId(ilpResult.transfer.transferId)

          read = Object.assign({}, read, {
            participantPayer: {
              name: ilpResult.participantPayer.name
            },
            participantPayee: {
              name: ilpResult.participantPayee.name
            }
          })

          ilpMap.set(result.ilpId, read)

          assert.comment(`Testing with ilp \n ${JSON.stringify(ilp, null, 2)}`)
          assert.equal(result.transferId, read.transferId, ' transferId match')
          assert.equal(result.packet, read.packet, ' packet match')
          assert.equal(result.condition, read.condition, ' condition match')
          assert.equal(result.fulfilment, read.fulfilment, ' fulfilment match')
          assert.end()
        } catch (err) {
          Logger.error(`create 1 ilp failed with error - ${err}`)
          assert.fail(`Create 1 ilp failed - ${err}`)
          assert.end()
        }
      })
      // assert.end()
    } catch (err) {
      Logger.error(`create all ilp objects failed with error - ${err}`)
      assert.fail(`Create all ilp objects failed - ${err}`)
      assert.end()
    }
  })

  await ilpTest.test('create ilp without transferId should throw error', async (assert) => {
    try {
      await Service.create({
        packet: 'test packet',
        condition: 'test condition',
        fulfilment: 'test fulfilment'
      })
      assert.end()
    } catch (err) {
      Logger.error('create ilp without transferId is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await ilpTest.test('create ilp without packet should throw error', async (assert) => {
    try {
      await Service.create({
        transferId: '10',
        condition: 'test condition',
        fulfilment: 'test fulfilment'
      })
      assert.end()
    } catch (err) {
      Logger.error('create ilp without packet is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await ilpTest.test('create ilp without condition should throw error', async (assert) => {
    try {
      await Service.create({
        transferId: '10',
        packet: 'test packet',
        fulfilment: 'test fulfilment'
      })
      assert.end()
    } catch (err) {
      Logger.error('create ilp without condition is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await ilpTest.test('getByTransferId', async (assert) => {
    try {
      for (let ilp of ilpMap.values()) {
        let result = await Service.getByTransferId(ilpMap.get(ilp.ilpId).transferId)
        assert.equal(JSON.stringify(Object.assign({},
          result,
          {
            participantPayer: {
              name: ilp.participantPayer.name
            },
            participantPayee: {
              name: ilp.participantPayee.name
            }
          }
        )), JSON.stringify(ilp))

        assert.comment(`Testing with ilp \n ${JSON.stringify(ilp, null, 2)}`)
        assert.equal(result.transferId, ilp.transferId, ' transferId match')
        assert.equal(result.packet, ilp.packet, ' packet match')
        assert.equal(result.condition, ilp.condition, ' condition match')
        assert.equal(result.fulfilment, ilp.fulfilment, ' fulfilment match')
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
      for (let ilp of ilpMap.values()) {
        let result = await Service.update(ilp.transferId, {packet: 'new test packet'})
        let ilpDb = await Service.getByTransferId(ilp.transferId)
        assert.equal(result, 1, ' ilp is updated')
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
      for (let ilp of ilpMap.values()) {
        await HelperModule.deletePreparedData('ilp', {
          ilpId: ilp.ilpId,
          transferId: ilp.transferId,
          payerName: ilp.participantPayer.name,
          payeeName: ilp.participantPayee.name
        })
      }
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
