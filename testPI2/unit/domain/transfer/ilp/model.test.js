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
const Model = require('../../../../../src/models/ilp')

Test('Ilp model', async (ilpTest) => {
  let sandbox

  const ilpTestValues = [
    {
      transferId: '1',
      packet: 'test packet',
      condition: 'test condition',
      fulfilment: 'test fulfilment'
    }
  ]
  const ilp = ilpTestValues[0]
  const ilpId = 1

  sandbox = Sinon.sandbox.create()
  Db.ilp = {
    select: sandbox.stub(),
    insert: sandbox.stub(),
    update: sandbox.stub(),
    findOne: sandbox.stub(),
    find: sandbox.stub(),
    query: sandbox.stub(),
    destroy: sandbox.stub()
  }

  await ilpTest.test('create false ilp', async (assert) => {
    const falseIlp = {
      transferId: '1',
      packet: '',
      condition: '',
      fulfilment: ''
    }

    Db.ilp.insert.withArgs({
      transferId: falseIlp.transferId,
      packet: falseIlp.packet,
      condition: falseIlp.condition,
      fulfilment: falseIlp.fulfilment
    }).throws(new Error('False insert ilp'))

    try {
      let r = await Model.create(falseIlp)
      assert.comment(r)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await ilpTest.test('create ilp', async (assert) => {
    try {
      Db.ilp.insert.withArgs({
        transferId: ilp.transferId,
        packet: ilp.packet,
        condition: ilp.condition,
        fulfilment: ilp.fulfilment
      }).returns(1)
      var result = await Model.saveIlp(ilp)
      assert.ok(result === 1, ` returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`create ilp failed with error - ${err}`)
      assert.fail(`create ilp failed with error - ${err}`)
      assert.end()
    }
  })

  await ilpTest.test('create false ilp', async (assert) => {
    const falseIlp = {transferId: '1', packet: undefined, condition: undefined, fulfilment: undefined}
    Db.ilp.insert.withArgs(falseIlp).throws(new Error())
    try {
      let r = await Model.saveIlp(falseIlp)
      console.log(r)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await ilpTest.test('getByTransferId', async (assert) => {
    let falseIlp = null
    Db.ilp.findOne.withArgs({transferId: falseIlp}).throws(new Error())
    try {
      await Model.getByTransferId(null)
      assert.fail('should throw')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await ilpTest.test('getByTransferId', async (assert) => {
    Db.ilp.findOne.withArgs({transferId: ilpTestValues[0].transferId}).returns(ilpTestValues[0])
    try {
      var result = await Model.getByTransferId('1')
      assert.equal(result.transferId, ilp.transferId, ' transferIds are equal')
      assert.equal(result.condition, ilp.condition, ' conditions match')
      assert.equal(result.fulfilment, ilp.fulfilment, ' fulfillments match')
      assert.end()
    } catch (err) {
      Logger.error(`create ilp failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await ilpTest.test('update false ilp', async (assert) => {
    const falseIlp = {
      transferId: '',
      ilpId: '',
      packet: '',
      condition: '',
      fulfilment: ''
    }

    Db.ilp.update.withArgs({
      ilpId: falseIlp.ilpId
    }).throws(new Error('False update ilp'))

    try {
      await Model.update(falseIlp, falseIlp)
      assert.fail(' should throws with empty transferId ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await ilpTest.test('update', async (assert) => {
    try {
      Db.ilp.update.withArgs(
        { ilpId: ilpId }, { packet: 'new test packet' }
      ).returns(ilpId)
      let updatedId = await Model.update({ ilpId: ilpId, packet: 'new test packet' })
      assert.equal(updatedId, ilpId)
      assert.end()
    } catch (err) {
      Logger.error(`update ilp failed with error - ${err}`)
      assert.fail(`update ilp failed with error - ${err}`)
      assert.end()
    }
  })

  await ilpTest.test('destroyByTransferId false ilp', async (assert) => {
    const falseIlp = {
      transferId: '',
      ilpId: '',
      packet: '',
      condition: '',
      fulfilment: ''
    }

    Db.ilp.destroy.withArgs({
      transferId: falseIlp.transferId
    }).throws(new Error('False destroyByTransferId ilp'))

    try {
      await Model.destroyByTransferId({ transferId: falseIlp.transferId })
      assert.fail(' should throws with empty transferId ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  await ilpTest.test('destroyByTransferId', async (assert) => {
    try {
      Db.ilp.destroy.withArgs(
        { transferId: ilpTestValues[0].transferId }
      ).returns(1)

      let updatedId = await Model.destroyByTransferId({ transferId: ilpTestValues[0].transferId })
      assert.equal(1, updatedId)
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
