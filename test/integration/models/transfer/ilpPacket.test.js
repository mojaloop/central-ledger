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
 * Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tape')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../../src/lib/config')
const Service = require('../../../../src/models/transfer/ilpPacket')
const HelperModule = require('../../helpers')

Test('Ilp service tests', async (ilpTest) => {
  const ilpTestValues = [
    {
      transferId: '1',
      value: 'test packet'
    }
  ]

  const ilpMap = new Map()

  await ilpTest.test('setup', async (assert) => {
    try {
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
          const ilpResult = await HelperModule.prepareNeededData('ilpPacket')
          const result = ilpResult.ilp

          let read = await Service.getByTransferId(ilpResult.transfer.transferId)

          read = Object.assign({}, read, {
            participantPayer: {
              name: ilpResult.transfer.payerFsp
            },
            participantPayee: {
              name: ilpResult.transfer.payeeFsp
            }
          })

          ilpMap.set(result.transferId, read)

          // assert.comment(`Testing with ilp \n ${JSON.stringify(ilp, null, 2)}`)
          assert.equal(result.transferId, read.transferId, ' transferId match')
          assert.equal(result.value, read.value, ' packet match')
          assert.end()
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
      await Service.saveIlpPacket({
        value: 'test packet'
      })
      assert.end()
    } catch (err) {
      // Logger.error('create ilp without transferId is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await ilpTest.test('create ilp without packet should throw error', async (assert) => {
    try {
      await Service.saveIlpPacket({
        transferId: '10'
      })
      assert.end()
    } catch (err) {
      // Logger.error('create ilp without packet is failing with message ')
      assert.ok((('message' in err) && ('stack' in err)), err.message)
      assert.end()
    }
  })

  await ilpTest.test('getByTransferId', async (assert) => {
    try {
      for (const ilp of ilpMap.values()) {
        const result = await Service.getByTransferId(ilpMap.get(ilp.transferId).transferId)
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

        // assert.comment(`Testing with ilp \n ${JSON.stringify(ilp, null, 2)}`)
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
      for (const ilp of ilpMap.values()) {
        const result = await Service.update({ transferId: ilp.transferId, value: 'new test packet' })
        const ilpDb = await Service.getByTransferId(ilp.transferId)
        assert.equal(result, 1, ' ilp is updated')
        assert.equal(ilp.transferId, ilpDb.transferId, ' ids match')
        assert.equal(ilpDb.value, 'new test packet', 'update is real')
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
      await Db.disconnect()
      assert.pass('database connection closed')
      assert.end()
    } catch (err) {
      Logger.error(`teardown failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  ilpTest.end()
})
