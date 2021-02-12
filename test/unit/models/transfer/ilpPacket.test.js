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

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const Model = require('../../../../src/models/transfer/ilpPacket')

Test('ilpPacket model', async (ilpTest) => {
  const ilpPacketTestValues = [
    {
      transferId: '1',
      value: 'test packet'
    }
  ]
  const ilpPacket = ilpPacketTestValues[0]

  let sandbox

  ilpTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()

    Db.ilpPacket = {
      select: sandbox.stub(),
      insert: sandbox.stub(),
      update: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      query: sandbox.stub(),
      destroy: sandbox.stub()
    }

    Db.from = (table) => {
      return Db[table]
    }

    t.end()
  })

  ilpTest.afterEach(t => {
    sandbox.restore()

    t.end()
  })

  await ilpTest.test('create false ilpPacket', async (assert) => {
    const falseIlp = { transferId: '1', value: undefined }
    Db.ilpPacket.insert.withArgs(falseIlp).throws(new Error())
    try {
      const r = await Model.saveIlpPacket(falseIlp)
      console.log(r)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err}`)
    }
    assert.end()
  })

  await ilpTest.test('create ilpPacket', async (assert) => {
    try {
      Db.ilpPacket.insert.withArgs({
        transferId: ilpPacket.transferId,
        value: ilpPacket.value
      }).returns(1)
      const result = await Model.saveIlpPacket(ilpPacket)
      assert.ok(result === 1, `returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`create ilpPacket failed with error - ${err}`)
      assert.fail(`create ilpPacket failed with error - ${err}`)
      assert.end()
    }
  })

  await ilpTest.test('getByTransferId with null transferId', async (assert) => {
    Db.ilpPacket.findOne.withArgs({ transferId: null }).throws(new Error())
    try {
      await Model.getByTransferId(null)
      assert.fail('should throw')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err}`)
    }
    assert.end()
  })

  await ilpTest.test('getByTransferId', async (assert) => {
    Db.ilpPacket.findOne.withArgs({ transferId: ilpPacketTestValues[0].transferId }).returns(ilpPacketTestValues[0])
    try {
      const result = await Model.getByTransferId('1')
      assert.equal(result.transferId, ilpPacket.transferId, 'transferIds are equal')
      assert.equal(result.condition, ilpPacket.condition, 'conditions match')
      assert.equal(result.fulfilment, ilpPacket.fulfilment, 'fulfilments match')
      assert.end()
    } catch (err) {
      Logger.error(`create ilpPacket failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await ilpTest.test('update false ilpPacket', async (assert) => {
    const falseIlpPacket = {
      transferId: '',
      value: ''
    }

    Db.ilpPacket.update.withArgs({
      transferId: falseIlpPacket.transferId
    }).throws(new Error('False update ilpPacket'))

    try {
      await Model.update(falseIlpPacket, falseIlpPacket)
      assert.fail(' should throw with empty transferId ')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err}`)
    }
    assert.end()
  })

  await ilpTest.test('destroyByTransferId false ilpPacket', async (assert) => {
    const falseIlpPacket = {
      transferId: '',
      ilpId: '',
      packet: '',
      condition: '',
      fulfilment: ''
    }

    Db.ilpPacket.destroy.withArgs({
      transferId: falseIlpPacket.transferId
    }).throws(new Error('False destroyByTransferId ilpPacket'))

    try {
      await Model.destroyByTransferId({ transferId: falseIlpPacket.transferId })
      assert.fail(' should throws with empty transferId ')
    } catch (err) {
      assert.assert(err instanceof Error, `throws ${err}`)
    }
    assert.end()
  })

  await ilpTest.test('destroyByTransferId', async (assert) => {
    try {
      Db.ilpPacket.destroy.withArgs(
        { transferId: ilpPacketTestValues[0].transferId }
      ).returns(1)

      const updatedId = await Model.destroyByTransferId({ transferId: ilpPacketTestValues[0].transferId })
      assert.equal(1, updatedId)
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`update ilpPacketPacket failed with error - ${err}`)
      assert.fail(`update ilpPacketPacket failed with error - ${err}`)
      sandbox.restore()
      assert.end()
    }
  })

  await ilpTest.end()
})
