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
const Db = require('../../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
// const Config = require('../../../../src/lib/config')
const Model = require('../../../../../src/domain/transfer/models/ilp-model')
const Service = require('../../../../../src/domain/transfer/ilp')

Test('Ilp service', async (ilpTest) => {
  let sandbox

  const ilpTestValues = [
    {
      transferId: '1',
      packet: 'test packet',
      condition: 'test condition',
      fulfilment: 'test fulfilment'
    }
  ]

  let ilpMap = new Map()

  await ilpTest.test('setup', async (assert) => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Model, 'create')
    sandbox.stub(Model, 'getByTransferId')
    sandbox.stub(Model, 'update')

    Db.ilp = {
      select: sandbox.stub(),
      insert: sandbox.stub(),
      update: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub()
    }

    ilpTestValues.forEach((ilp, index) => {
      ilpMap.set(index + 1, ilp)
      Db.ilp.insert.withArgs({ilp}).returns(index)

      Model.create.withArgs({
        transferId: ilp.transferId,
        packet: ilp.packet,
        condition: ilp.condition,
        fulfilment: ilp.fulfilment
      }).returns(index + 1)
      Model.getByTransferId.withArgs(ilp.transferId).returns(Object.assign(
        {},
        ilp,
        { ilpId: (index + 1) }
      ))
      Model.update.withArgs(Object.assign(
        {},
        ilp,
        { ilpId: (index + 1) }
      ), { packet: 'new test packet' }).returns(index + 1)
    })
    assert.pass('setup OK')
    assert.end()
  })

  await ilpTest.test('create false ilp', async (assert) => {
    const falseIlp = {transferId: '1', packet: undefined, condition: undefined, fulfilment: undefined}
    Model.create.withArgs(falseIlp).throws(new Error())
    try {
      let r = await Service.create(falseIlp)
      console.log(r)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await ilpTest.test('create ilp', async (assert) => {
    try {
      for (let [index, ilp] of ilpMap) {
        var result = await Service.create({
          transferId: ilp.transferId,
          packet: ilp.packet,
          condition: ilp.condition,
          fulfilment: ilp.fulfilment
        })
        ilpMap.set(index, Object.assign(
          {},
          ilp,
          { ilpId: result }
        ))
        assert.comment(`Testing with ilp \n ${JSON.stringify(ilp, null, 2)}`)
        assert.ok(result === index, ` returns ${result}`)
      }
      assert.end()
    } catch (err) {
      Logger.error(`create ilp failed with error - ${err}`)
      assert.fail(`create ilp failed with error - ${err}`)
      assert.end()
    }
  })

  await ilpTest.test('get with empty transferId', async (assert) => {
    Model.getByTransferId.withArgs('').throws(new Error())
    try {
      Service.getByTransferId('')
      assert.fail(' should throws with empty name ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await ilpTest.test('getByTransferId', async (assert) => {
    try {
      for (let [index, ilp] of ilpMap) {
        let ilpResult = await Service.getByTransferId(ilp.transferId)
        assert.equal(JSON.stringify(ilpResult), JSON.stringify(ilpMap.get(index)))
      }
      assert.end()
    } catch (err) {
      Logger.error(`get ilp by transferId failed with error - ${err}`)
      assert.fail(`get ilp by transferId failed with error - ${err}`)
      assert.end()
    }
  })

  await ilpTest.test('update', async (assert) => {
    try {
      for (let ilp of ilpMap.values()) {
        let updated = await Service.update(ilp.transferId, { packet: 'new test packet' })
        assert.equal(updated, ilp.ilpId)
      }
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`update ilp failed with error - ${err}`)
      assert.fail(`update ilp failed with error - ${err}`)
      sandbox.restore()
      assert.end()
    }
  })
})
