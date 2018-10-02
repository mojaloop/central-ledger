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
    Db.participantLimit = {
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

  const endpoints = [
    {
      participantEndpointId: 1,
      participantId: 1,
      endpointTypeId: 1,
      value: 'http://localhost:3001/participants/dfsp1/notification1',
      isActive: 1,
      createdDate: '2018-07-11',
      createdBy: 'unknown',
      name: 'FSPIOP_CALLBACK_URL_TRANSFER_POST'
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
      let builderStub = sandbox.stub()
      Db.participant.query.callsArgWith(0, builderStub)
      builderStub.where = sandbox.stub()

      builderStub.where.returns({
        andWhere: sandbox.stub().returns({
          andWhere: sandbox.stub().returns({
            andWhere: sandbox.stub().returns({
              andWhere: sandbox.stub().returns({
                innerJoin: sandbox.stub().returns({
                  select: sandbox.stub().returns({
                    first: sandbox.stub().returns(participant)
                  })
                })
              })
            })
          })
        })
      })

      var result = await Model.getByNameAndCurrency({ name: 'fsp1', currencyId: 'USD', ledgerAccountTypeId: 1 })
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
      await Model.getByNameAndCurrency({ name: 'fsp1', currencyId: 'USD', ledgerAccountTypeId: 1 })
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
      await Model.getByNameAndCurrency({ name: 'fsp3', currencyId: 'USD', ledgerAccountTypeId: 1 })
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
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        where: sandbox.stub().returns({
          select: sandbox.stub().returns({
            first: sandbox.stub().returns({ endpointTypeId: 1 })
          })
        }),
        transacting: sandbox.stub().returns({
          forUpdate: sandbox.stub().returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns([{ participantEndpointId: 1 }])
            })
          }),
          update: sandbox.stub().returns({
            where: sandbox.stub().returns([1])
          }),
          insert: sandbox.stub().returns([1])
        })
      })

      const endpoint = {
        type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }

      const expected = {
        createdBy: 'unknown',
        endpointTypeId: 1,
        isActive: 1,
        participantEndpointId: 1,
        participantId: 1,
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }
      var result = await Model.addEndpoint(participant.participantId, endpoint)
      assert.ok(knexStub.withArgs('participantEndpoint').calledThrice, 'knex called with participantLimit thrice')
      assert.ok(knexStub.withArgs('endpointType').calledOnce, 'knex called with endpointType once')
      assert.deepEqual(result, expected)
      assert.end()
    } catch (err) {
      Logger.error(`addEndpoint failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('addEndpoint if it doesnt exist', async (assert) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        where: sandbox.stub().returns({
          select: sandbox.stub().returns({
            first: sandbox.stub().returns({ endpointTypeId: 1 })
          })
        }),
        transacting: sandbox.stub().returns({
          forUpdate: sandbox.stub().returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns([])
            })
          }),
          update: sandbox.stub().returns({
            where: sandbox.stub().returns([1])
          }),
          insert: sandbox.stub().returns([1])
        })
      })

      const endpoint = {
        type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }

      const expected = {
        createdBy: 'unknown',
        endpointTypeId: 1,
        isActive: 1,
        participantEndpointId: 1,
        participantId: 1,
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }
      var result = await Model.addEndpoint(participant.participantId, endpoint)
      assert.ok(knexStub.withArgs('participantEndpoint').calledTwice, 'knex called with participantLimit twice')
      assert.ok(knexStub.withArgs('endpointType').calledOnce, 'knex called with endpointType once')
      assert.deepEqual(result, expected)
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
        type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
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

  await facadeTest.test('addEndpoint should fail and rollback', async (assert) => {
    try {
      const endpoint = {
        type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
        value: 'http://localhost:3001/participants/dfsp1/notification1'
      }
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()

      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      knexStub.throws(new Error())

      await Model.addEndpoint(participant.participantId, endpoint)
      assert.fail(' should throw')
      assert.end()
      assert.end()
    } catch (err) {
      Logger.error(`addEndpoint failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('addLimitAndInitialPosition', async (assert) => {
    try {
      const limitPostionObj = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        },
        initialPosition: 0
      }
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        where: sandbox.stub().returns({
          select: sandbox.stub().returns({
            first: sandbox.stub().returns({ participantLimitTypeId: 1 })
          })
        }),
        transacting: sandbox.stub().returns({
          insert: sandbox.stub().returns([1])
        })
      })
      let participantPosition = {
        participantCurrencyId: 1,
        value: limitPostionObj.initialPosition,
        reservedValue: 0,
        participantPositionId: 1
      }
      let participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: limitPostionObj.limit.value,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1
      }

      const result = await Model.addLimitAndInitialPosition(participant.participantCurrencyId, limitPostionObj)
      assert.pass('completed successfully')
      assert.ok(knexStub.withArgs('participantLimit').calledOnce, 'knex called with participantLimit once')
      assert.ok(knexStub.withArgs('participantPosition').calledOnce, 'knex called with participantPosition once')
      assert.deepEqual(result, { participantLimit, participantPosition })

      assert.end()
    } catch (err) {
      Logger.error(`addLimitAndInitialPosition failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('addLimitAndInitialPosition should throw error', async (assert) => {
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

      await Model.addLimitAndInitialPosition(participant.participantCurrencyId, limitPostionObj)
      assert.fail(' should throw')
      assert.end()
    } catch (err) {
      Logger.error(`addLimitAndInitialPosition failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('addLimitAndInitialPosition should fail and rollback', async (assert) => {
    try {
      const limitPostionObj = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        },
        initialPosition: 0
      }
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()

      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      knexStub.throws(new Error())

      await Model.addLimitAndInitialPosition(participant.participantCurrencyId, limitPostionObj)
      assert.fail(' should throw')
      assert.end()
      assert.end()
    } catch (err) {
      Logger.error(`addLimitAndInitialPosition failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('adjustLimits', async (assert) => {
    try {
      const limit = {
        type: 'NET_DEBIT_CAP',
        value: 10000000
      }
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        where: sandbox.stub().returns({
          select: sandbox.stub().returns({
            first: sandbox.stub().returns({ participantLimitTypeId: 1 })
          })
        }),
        transacting: sandbox.stub().returns({
          forUpdate: sandbox.stub().returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns([{ participantLimitId: 1 }])
            })
          }),
          update: sandbox.stub().returns({
            where: sandbox.stub().returns([1])
          }),
          insert: sandbox.stub().returns([1])
        })
      })
      let participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: limit.value,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1
      }

      const result = await Model.adjustLimits(participant.participantCurrencyId, limit)
      assert.pass('completed successfully')
      assert.ok(knexStub.withArgs('participantLimit').calledThrice, 'knex called with participantLimit thrice')
      assert.ok(knexStub.withArgs('participantLimitType').calledOnce, 'knex called with participantLimitType once')
      assert.deepEqual(result, { participantLimit })

      assert.end()
    } catch (err) {
      Logger.error(`adjustLimits failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('adjustLimits throws error when limit does not exist', async (assert) => {
    try {
      const limit = {
        type: 'NET_DEBIT_CAP',
        value: 10000000
      }
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      knexStub.returns({
        where: sandbox.stub().returns({
          select: sandbox.stub().returns({
            first: sandbox.stub().returns({ participantLimitTypeId: 1 })
          })
        }),
        transacting: sandbox.stub().returns({
          forUpdate: sandbox.stub().returns({
            select: sandbox.stub().returns({
              where: sandbox.stub().returns([])
            })
          }),
          update: sandbox.stub().returns({
            where: sandbox.stub().returns([1])
          }),
          insert: sandbox.stub().returns([1])
        })
      })
      await Model.adjustLimits(participant.participantCurrencyId, limit)
      assert.fail(' should throw')
      assert.end()
    } catch (err) {
      Logger.error(`adjustLimits failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('adjustLimits should throw error', async (assert) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const obj = {
        transaction: async () => { }
      }
      Db.getKnex.returns(obj)
      const knex = Db.getKnex()
      sandbox.stub(knex, 'transaction')
      knex.transaction.throws(new Error('message'))
      const limit = {
        type: 'NET_DEBIT_CAP',
        value: 10000000
      }

      await Model.adjustLimits(participant.participantCurrencyId, limit)
      assert.fail(' should throw')
      assert.end()
    } catch (err) {
      Logger.error(`adjustLimits failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('adjustLimits should fail and rollback', async (assert) => {
    try {
      const limit = {
        type: 'NET_DEBIT_CAP',
        value: 10000000
      }
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()

      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      knexStub.throws(new Error())

      await Model.adjustLimits(participant.participantCurrencyId, limit)
      assert.fail(' should throw')
      assert.end()
      assert.end()
    } catch (err) {
      Logger.error(`adjustLimits failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('getParticipantLimitsByCurrencyId', async (assert) => {
    try {
      let participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 1000000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        name: 'NET_DEBIT_CAP'
      }

      let builderStub = sandbox.stub()
      let whereStub = { where: sandbox.stub().returns() }

      Db.participantLimit.query.callsArgWith(0, builderStub)
      builderStub.innerJoin = sandbox.stub()

      builderStub.innerJoin.returns({
        where: sandbox.stub().returns({
          where: sandbox.stub().callsArgWith(0, whereStub).returns({
            select: sandbox.stub().returns({
              orderBy: sandbox.stub().returns(participantLimit)
            })
          })
        })
      })

      var result = await Model.getParticipantLimitsByCurrencyId(participant.participantCurrencyId, 'NET_DEBIT_CAP')
      assert.deepEqual(result, participantLimit)
      assert.end()
    } catch (err) {
      Logger.error(`getParticipantLimitsByCurrencyId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getParticipantLimitsByCurrencyId called without type', async (assert) => {
    try {
      let participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 1000000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        name: 'NET_DEBIT_CAP'
      }

      let builderStub = sandbox.stub()
      Db.participantLimit.query.callsArgWith(0, builderStub)
      builderStub.innerJoin = sandbox.stub()
      let whereStub = { where: sandbox.stub().returns() }

      builderStub.innerJoin.returns({
        where: sandbox.stub().returns({
          where: sandbox.stub().callsArgWith(0, whereStub).returns({
            select: sandbox.stub().returns({
              orderBy: sandbox.stub().returns(participantLimit)
            })
          })
        })
      })
      var result = await Model.getParticipantLimitsByCurrencyId(participant.participantCurrencyId)
      assert.deepEqual(result, participantLimit)
      assert.end()
    } catch (err) {
      Logger.error(`getParticipantLimitsByCurrencyId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getParticipantLimitsByCurrencyId should throw error', async (assert) => {
    try {
      let builderStub = sandbox.stub()
      Db.participantLimit.query.callsArgWith(0, builderStub)
      builderStub.innerJoin = sandbox.stub()

      builderStub.innerJoin.throws(new Error())
      await Model.getParticipantLimitsByCurrencyId(participant.participantCurrencyId)
      assert.fail(' should throw')
      assert.end()
      assert.end()
    } catch (err) {
      Logger.error(`getParticipantLimitsByCurrencyId failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('getParticipantLimitsByParticipantId', async (assert) => {
    try {
      let participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 1000000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        name: 'NET_DEBIT_CAP'
      }

      let builderStub = sandbox.stub()
      Db.participantLimit.query.callsArgWith(0, builderStub)
      builderStub.innerJoin = sandbox.stub()
      let whereStub = { where: sandbox.stub().returns() }

      builderStub.innerJoin.returns({
        innerJoin: sandbox.stub().returns({
          where: sandbox.stub().returns({
            where: sandbox.stub().callsArgWith(0, whereStub).returns({
              select: sandbox.stub().returns({
                orderBy: sandbox.stub().returns(participantLimit)
              })
            })
          })
        })
      })
      var result = await Model.getParticipantLimitsByParticipantId(participant.participantId, 1, 'NET_DEBIT_CAP')
      assert.deepEqual(result, participantLimit)
      assert.end()
    } catch (err) {
      Logger.error(`getParticipantLimitsByParticipantId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getParticipantLimitsByParticipantId called without type', async (assert) => {
    try {
      let participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 1000000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        name: 'NET_DEBIT_CAP'
      }

      let builderStub = sandbox.stub()
      Db.participantLimit.query.callsArgWith(0, builderStub)
      builderStub.innerJoin = sandbox.stub()
      let whereStub = { where: sandbox.stub().returns() }

      builderStub.innerJoin.returns({
        innerJoin: sandbox.stub().returns({
          where: sandbox.stub().returns({
            where: sandbox.stub().callsArgWith(0, whereStub).returns({
              select: sandbox.stub().returns({
                orderBy: sandbox.stub().returns(participantLimit)
              })
            })
          })
        })
      })
      var result = await Model.getParticipantLimitsByParticipantId(participant.participantId, 1)
      assert.deepEqual(result, participantLimit)
      assert.end()
    } catch (err) {
      Logger.error(`getParticipantLimitsByParticipantId failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getParticipantLimitsByParticipantId should throw error', async (assert) => {
    try {
      let builderStub = sandbox.stub()
      Db.participantLimit.query.callsArgWith(0, builderStub)
      builderStub.innerJoin = sandbox.stub()

      builderStub.innerJoin.throws(new Error())
      await Model.getParticipantLimitsByParticipantId(participant.participantId, 1)
      assert.fail(' should throw')
      assert.end()
      assert.end()
    } catch (err) {
      Logger.error(`getParticipantLimitsByParticipantId failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.end()
})
