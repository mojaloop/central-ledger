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

const Test = require('tape') // require('tapes')(require('tape')) //
const Sinon = require('sinon')
const Db = require('../../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
// const Config = require('../../../../src/lib/config')
const Model = require('../../../../../src/domain/transfer/models/ilp-model')

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
    find: sandbox.stub()
  }

  await ilpTest.test('create false ilp', async (assert) => {
    const falseIlp = {transferId: '1'}
    Db.ilp.insert.withArgs({
      transferId: falseIlp.transferId
    }).throws(new Error('message'))
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
      var result = await Model.create(ilp)
      assert.ok(result === 1, ` returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`create ilp failed with error - ${err}`)
      assert.fail(`create ilp failed with error - ${err}`)
      assert.end()
    }
  })

  await ilpTest.test('get with empty transferId', async (assert) => {
    Db.ilp.findOne.withArgs({ transferId: '' }).throws(new Error())
    try {
      await Model.getByTransferId('')
      assert.fail(' should throws with empty transferId ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })

  // await ilpTest.test('getByTransferId', async (assert) => {
  //   try {
  //     Db.ilp.select.withArgs({ transferId: '1' }).returns(ilpTestValues[0])
  //     var result = await Model.getByTransferId('1')
  //     assert.equal(result.transferId, ilp.transferId, ' transferIds are equal')
  //     assert.equal(result.condition, ilp.condition, ' conditions match')
  //     assert.equal(result.fulfilment, ilp.fulfilment, ' fulfillments match')
  //     assert.end()
  //   } catch (err) {
  //     Logger.error(`create ilp failed with error - ${err}`)
  //     assert.fail()
  //     assert.end()
  //   }
  // })

  await ilpTest.test('update', async (assert) => {
    try {
      Db.ilp.update.withArgs(
        { ilpId: ilpId }, { packet: 'new test packet' }
      ).returns(ilpId)
      let updatedId = await Model.update({ ilpId: ilpId }, { packet: 'new test packet' })
      assert.equal(updatedId, ilpId)
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
