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
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/db/index')
const Logger = require('@mojaloop/central-services-shared').Logger
const Model = require('../../../../src/models/participant/facade')

Test('Participant facade', async (facadeTest) => {
  let sandbox

  facadeTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.participant = {
      query: sandbox.stub()
    }
    Db.participantEndpoint = {
      query: sandbox.stub()
    }
    t.end()
  })

  facadeTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  const participant = {
    participantId: 1,
    name: 'fsp1',
    currency: 'USD',
    isActive: 1,
    createdDate: new Date(),
    createdBy: 'unknown',
    participantCurrencyId: 1
  }

  // sandbox = Sinon.createSandbox()
  // sandbox.stub(Db, 'getKnex')
  // const obj = {
  //   transaction: async () => { }
  // }
  // Db.getKnex.returns(obj)
  // const knex = Db.getKnex()
  // sandbox.stub(knex, 'transaction')

  const endpoints = [
    {
      participantEndpointId: 1,
      participantId: 1,
      endpointTypeId: 1,
      value: 'http://localhost:3001/participants/dfsp1/notification1',
      isActive: 1,
      createdDate: '2018-07-11',
      createdBy: 'unknown',
      name: 'FSIOP_CALLBACK_URL'
    },
    {
      participantEndpointId: 2,
      participantId: 1,
      endpointTypeId: 2,
      value: 'http://localhost:3001/participants/dfsp1/notification2',
      isActive: 1,
      createdDate: '2018-07-11',
      createdBy: 'unknown',
      name: 'ALARM_NOTIFICATION_URL'
    }
  ]

  await facadeTest.test('getByNameAndCurrency', async (assert) => {
    try {
      Db.participant.query.returns(participant)
      var result = await Model.getByNameAndCurrency({ name: 'fsp1', currencyId: 'USD' })
      assert.deepEqual(result, participant)
      assert.end()
    } catch (err) {
      Logger.error(`getByNameAndCurrency failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getByNameAndCurrency should throw error', async (assert) => {
    try {
      Db.participant.query.throws(new Error('message'))
      await Model.getByNameAndCurrency({ name: 'fsp1', currencyId: 'USD' })
      assert.fail(' should throw')
      assert.end()
    } catch (err) {
      Logger.error(`getByNameAndCurrency failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('getByNameAndCurrency should throw error when participant not found', async (assert) => {
    try {
      Db.participant.query.throws(new Error('message'))
      await Model.getByNameAndCurrency({ name: 'fsp3', currencyId: 'USD' })
      assert.fail(' should throw')
      assert.end()
    } catch (err) {
      Logger.error(`getByNameAndCurrency failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('getEndpoint', async (assert) => {
    try {
      let builderStub = sandbox.stub()
      let whereStub = sandbox.stub()
      let selectStub = sandbox.stub()

      builderStub.innerJoin = sandbox.stub()

      Db.participantEndpoint.query.callsArgWith(0, builderStub)
      Db.participantEndpoint.query.returns([endpoints[0]])
      builderStub.innerJoin.returns({
        where: whereStub.returns({
          select: selectStub.returns([endpoints[0]])
        })
      })
      const result = await Model.getEndpoint({ participantId: participant.participantId, endpointType: endpoints[0].name })
      assert.deepEqual(result[0], endpoints[0])
      assert.ok(builderStub.innerJoin.withArgs('endpointType AS et', 'participantEndpoint.endpointTypeId', 'et.endpointTypeId').calledOnce)

      assert.ok(whereStub.withArgs({
        'participantEndpoint.participantId': participant.participantId,
        'participantEndpoint.isActive': 1,
        'et.name': endpoints[0].name
      }))

      assert.ok(selectStub.withArgs(
        'participantEndpoint.*',
        'et.name'
      ).calledOnce)
      assert.end()
    } catch (err) {
      Logger.error(`getEndpoint failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getEndpoint should throw error', async (assert) => {
    try {
      Db.participantEndpoint.query.throws(new Error('message'))
      await Model.getEndpoint({ participantId: participant.participantId, endpointType: endpoints[0].name })
      assert.fail(' should throw')
      assert.end()
    } catch (err) {
      Logger.error(`getEndpoint failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('getAllEndpoints', async (assert) => {
    try {
      let builderStub = sandbox.stub()
      let whereStub = sandbox.stub()
      let selectStub = sandbox.stub()

      builderStub.innerJoin = sandbox.stub()

      Db.participantEndpoint.query.callsArgWith(0, builderStub)
      Db.participantEndpoint.query.returns(endpoints)
      builderStub.innerJoin.returns({
        where: whereStub.returns({
          select: selectStub.returns(endpoints)
        })
      })
      const result = await Model.getAllEndpoints(participant.participantId)
      assert.deepEqual(result, endpoints)
      assert.ok(builderStub.innerJoin.withArgs('endpointType AS et', 'participantEndpoint.endpointTypeId', 'et.endpointTypeId').calledOnce)

      assert.ok(whereStub.withArgs({
        'participantEndpoint.participantId': participant.participantId,
        'participantEndpoint.isActive': 1
      }))

      assert.ok(selectStub.withArgs(
        'participantEndpoint.*',
        'et.name'
      ).calledOnce)
      assert.end()
    } catch (err) {
      Logger.error(`getAllEndpoints failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getAllEndpoints should throw error', async (assert) => {
    try {
      Db.participantEndpoint.query.throws(new Error('message'))
      await Model.getAllEndpoints(participant.participantId)
      assert.fail(' should throw')
      assert.end()
    } catch (err) {
      Logger.error(`getAllEndpoints failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('addEndpoint', async (assert) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const obj = {
        transaction: async () => { }
      }
      Db.getKnex.returns(obj)
      const knex = Db.getKnex()
      sandbox.stub(knex, 'transaction')
      knex.transaction.returns(1)
      const endpoint = {
        type: 'FSIOP_CALLBACK_URL',
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }
      var result = await Model.addEndpoint(participant.participantId, endpoint)
      assert.equal(result, 1)
      assert.end()
    } catch (err) {
      Logger.error(`addEndpoint failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('addEndpoint should throw error', async (assert) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const obj = {
        transaction: async () => { }
      }
      Db.getKnex.returns(obj)
      const knex = Db.getKnex()
      sandbox.stub(knex, 'transaction')
      knex.transaction.throws(new Error('message'))
      const endpoint = {
        type: 'FSIOP_CALLBACK_URL',
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }

      await Model.addEndpoint(participant.participantId, endpoint)
      assert.fail(' should throw')
      assert.end()
    } catch (err) {
      Logger.error(`addEndpoint failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('addInitialPositionAndLimits', async (assert) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const obj = {
        transaction: async () => { }
      }
      Db.getKnex.returns(obj)
      const knex = Db.getKnex()
      sandbox.stub(knex, 'transaction')
      knex.transaction.returns(1)
      const limitPostionObj = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        },
        initialPosition: 0
      }
      var result = await Model.addInitialPositionAndLimits(participant.participantCurrencyId, limitPostionObj)
      assert.equal(result, 1)
      assert.end()
    } catch (err) {
      Logger.error(`addInitialPositionAndLimits failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('addInitialPositionAndLimits should throw error', async (assert) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const obj = {
        transaction: async () => { }
      }
      Db.getKnex.returns(obj)
      const knex = Db.getKnex()
      sandbox.stub(knex, 'transaction')
      knex.transaction.throws(new Error('message'))
      const limitPostionObj = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        },
        initialPosition: 0
      }

      await Model.addInitialPositionAndLimits(participant.participantCurrencyId, limitPostionObj)
      assert.fail(' should throw')
      assert.end()
    } catch (err) {
      Logger.error(`addInitialPositionAndLimits failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.end()
})
