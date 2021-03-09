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
const Db = require('../../../../src/lib/db')
const Cache = require('../../../../src/lib/cache')
const Logger = require('@mojaloop/central-services-logger')
const Proxyquire = require('proxyquire').callThru()
const Model = Proxyquire('../../../../src/models/participant/facade', {
  '../../lib/config': {
    HUB_NAME: 'Hub'
  }
})
const Enum = require('@mojaloop/central-services-shared').Enum
const ParticipantModel = require('../../../../src/models/participant/participantCached')
const ParticipantCurrencyModel = require('../../../../src/models/participant/participantCurrencyCached')
const ParticipantLimitModel = require('../../../../src/models/participant/participantLimitCached')
const SettlementModel = require('../../../../src/models/settlement/settlementModel')

Test('Participant facade', async (facadeTest) => {
  let sandbox

  facadeTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(ParticipantModel, 'getById')
    sandbox.stub(ParticipantModel, 'getByName')
    sandbox.stub(ParticipantCurrencyModel, 'findOneByParams')
    sandbox.stub(ParticipantCurrencyModel, 'invalidateParticipantCurrencyCache')
    sandbox.stub(ParticipantLimitModel, 'getByParticipantCurrencyId')
    sandbox.stub(ParticipantLimitModel, 'invalidateParticipantLimitCache')
    sandbox.stub(SettlementModel, 'getAll')
    sandbox.stub(Cache)
    Db.participant = {
      query: sandbox.stub()
    }
    Db.participantEndpoint = {
      query: sandbox.stub()
    }
    Db.participantLimit = {
      query: sandbox.stub()
    }
    Db.participantCurrency = {
      query: sandbox.stub()
    }
    Db.participantPosition = {
      query: sandbox.stub()
    }
    Db.from = (table) => {
      return Db[table]
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
    participantCurrencyId: 1,
    settlementAccountId: 2
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
  const settlementModelFixtures = [
    {
      settlementModelId: 1,
      name: 'DEFERREDNET',
      isActive: 1,
      settlementGranularityId: 2,
      settlementInterchangeId: 2,
      settlementDelayId: 2,
      currencyId: 'USD',
      requireLiquidityCheck: 1,
      ledgerAccountTypeId: 1,
      autoPositionReset: 1,
      adjustPosition: 0,
      settlementAccountTypeId: 2
    },
    {
      settlementModelId: 2,
      name: 'INTERCHANGEFEE',
      isActive: 1,
      settlementGranularityId: 2,
      settlementInterchangeId: 2,
      settlementDelayId: 2,
      currencyId: 'USD',
      requireLiquidityCheck: 0,
      ledgerAccountTypeId: 5,
      autoPositionReset: 1,
      adjustPosition: 0,
      settlementAccountTypeId: 6
    }
  ]

  await facadeTest.test('getByNameAndCurrency (cache off)', async (assert) => {
    try {
      const builderStub = sandbox.stub()
      Db.participant.query.callsArgWith(0, builderStub)
      builderStub.where = sandbox.stub()

      builderStub.where.returns({
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

      const result = await Model.getByNameAndCurrency('fsp1', 'USD', Enum.Accounts.LedgerAccountType.POSITION)
      assert.deepEqual(result, participant)
      assert.end()
    } catch (err) {
      Logger.error(`getByNameAndCurrency failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getByNameAndCurrency (cache off)', async (assert) => {
    try {
      const builderStub = sandbox.stub()
      Db.participant.query.callsArgWith(0, builderStub)
      builderStub.where = sandbox.stub()

      builderStub.where.returns({
        andWhere: sandbox.stub().returns({
          andWhere: sandbox.stub().returns({
            innerJoin: sandbox.stub().returns({
              select: sandbox.stub().returns({
                first: sandbox.stub().returns({
                  andWhere: sandbox.stub().returns(participant)
                })
              })
            })
          })
        })
      })

      const result = await Model.getByNameAndCurrency('fsp1', 'USD', Enum.Accounts.LedgerAccountType.POSITION, true)
      assert.deepEqual(result, participant)
      assert.end()
    } catch (err) {
      Logger.error(`getByNameAndCurrency failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getByNameAndCurrency should throw error (cache off)', async (assert) => {
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

  await facadeTest.test('getByNameAndCurrency should throw error when participant not found (cache off)', async (assert) => {
    try {
      Db.participant.query.throws(new Error('message'))
      await Model.getByNameAndCurrency({ name: 'fsp3', currencyId: 'USD', ledgerAccountTypeId: 1 })
      assert.fail('should throw')
      assert.end()
    } catch (err) {
      Logger.error(`getByNameAndCurrency failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('getByNameAndCurrency (cache on)', async (assert) => {
    try {
      Cache.isCacheEnabled.returns(true)

      ParticipantModel.getByName.withArgs(participant.name).returns(participant)
      ParticipantCurrencyModel.findOneByParams.withArgs({
        participantId: participant.participantId,
        currencyId: participant.currency,
        ledgerAccountTypeId: Enum.Accounts.LedgerAccountType.POSITION
      }).returns(participant)

      const result = await Model.getByNameAndCurrency(participant.name, participant.currency, Enum.Accounts.LedgerAccountType.POSITION)
      assert.deepEqual(result, participant)
      assert.end()
    } catch (err) {
      Logger.error(`getByNameAndCurrency failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getByNameAndCurrency isCurrencyActive:true (cache on)', async (assert) => {
    try {
      Cache.isCacheEnabled.returns(true)

      ParticipantModel.getByName.withArgs(participant.name).returns(participant)
      ParticipantCurrencyModel.findOneByParams.withArgs({
        participantId: participant.participantId,
        currencyId: participant.currency,
        ledgerAccountTypeId: Enum.Accounts.LedgerAccountType.POSITION,
        isActive: true
      }).returns(participant)

      const result = await Model.getByNameAndCurrency(participant.name, participant.currency, Enum.Accounts.LedgerAccountType.POSITION, true)
      assert.deepEqual(result, participant)
      assert.end()
    } catch (err) {
      Logger.error(`getByNameAndCurrency failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getEndpoint', async (assert) => {
    try {
      const builderStub = sandbox.stub()
      const whereStub = sandbox.stub()
      const selectStub = sandbox.stub()

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
      const builderStub = sandbox.stub()
      const whereStub = sandbox.stub()
      const selectStub = sandbox.stub()

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
      const result = await Model.addEndpoint(participant.participantId, endpoint)
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

  await facadeTest.test('addEndpoint if it does not exist', async (assert) => {
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
      const result = await Model.addEndpoint(participant.participantId, endpoint)
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

  await facadeTest.test('addLimitAndInitialPosition with settlementModel', async (assert) => {
    try {
      const limitPositionObj = {
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

      const insertStub = sandbox.stub()
      insertStub.returns([1])

      knexStub.returns({
        where: sandbox.stub().returns({
          select: sandbox.stub().returns({
            first: sandbox.stub().returns({ participantLimitTypeId: 1 })
          })
        }),
        transacting: sandbox.stub().returns({
          insert: insertStub
        })
      })
      const builderStub = sandbox.stub()
      Db.participant.query.callsArgWith(0, builderStub)
      builderStub.where = sandbox.stub()

      builderStub.where.returns({
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

      SettlementModel.getAll.returns(Promise.resolve(settlementModelFixtures))
      const result = await Model.addLimitAndInitialPosition(participant.participantCurrencyId, participant.settlementAccountId, limitPositionObj)
      assert.pass('completed successfully')
      assert.ok(knexStub.withArgs('participantLimit').calledOnce, 'knex called with participantLimit once')
      assert.equal(knexStub.withArgs('participantPosition').callCount, 4, 'knex called with participantPosition 4 times')
      assert.equal(result, true)

      assert.end()
    } catch (err) {
      Logger.error(`addLimitAndInitialPosition failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('addLimitAndInitialPosition without settlementModel', async (assert) => {
    try {
      const limitPositionObj = {
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

      const insertStub = sandbox.stub()
      insertStub.returns([1])

      knexStub.returns({
        where: sandbox.stub().returns({
          select: sandbox.stub().returns({
            first: sandbox.stub().returns({ participantLimitTypeId: 1 })
          })
        }),
        transacting: sandbox.stub().returns({
          insert: insertStub
        })
      })
      const builderStub = sandbox.stub()
      Db.participant.query.callsArgWith(0, builderStub)
      builderStub.where = sandbox.stub()

      builderStub.where.returns({
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

      SettlementModel.getAll.returns(Promise.resolve([]))
      const result = await Model.addLimitAndInitialPosition(participant.participantCurrencyId, participant.settlementAccountId, limitPositionObj)
      assert.pass('completed successfully')
      assert.ok(knexStub.withArgs('participantLimit').calledOnce, 'knex called with participantLimit once')
      assert.equal(knexStub.withArgs('participantPosition').callCount, 2, 'knex called with participantPosition 2 times')
      assert.equal(result, true)

      assert.end()
    } catch (err) {
      Logger.error(`addLimitAndInitialPosition failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('addLimitAndInitialPosition and activate participant currency', async (assert) => {
    try {
      const limitPositionObj = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        },
        initialPosition: 0,
        name: participant.name
      }
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)

      const insertStub = sandbox.stub()
      insertStub.returns([1])

      const whereStub = sandbox.stub()
      insertStub.returns([1])

      knexStub.returns({
        where: sandbox.stub().returns({
          select: sandbox.stub().returns({
            first: sandbox.stub().returns({ participantLimitTypeId: 1 })
          })
        }),
        transacting: sandbox.stub().returns({
          insert: insertStub,
          update: sandbox.stub().returns({
            where: whereStub
          })
        })
      })
      const builderStub = sandbox.stub()
      Db.participant.query.callsArgWith(0, builderStub)
      builderStub.where = sandbox.stub()

      builderStub.where.returns({
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

      SettlementModel.getAll.returns(Promise.resolve(settlementModelFixtures))
      const result = await Model.addLimitAndInitialPosition(participant.participantCurrencyId, participant.settlementAccountId, limitPositionObj, true)
      assert.pass('completed successfully')
      assert.ok(knexStub.withArgs('participantLimit').calledOnce, 'knex called with participantLimit once')
      assert.equal(knexStub.withArgs('participantPosition').callCount, 4, 'knex called with participantPosition 4 times')
      assert.equal(result, true)

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
      const limitPositionObj = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        },
        initialPosition: 0
      }

      await Model.addLimitAndInitialPosition(participant.participantCurrencyId, limitPositionObj)
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
      const limitPositionObj = {
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

      await Model.addLimitAndInitialPosition(participant.participantCurrencyId, limitPositionObj)
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
        value: 10000000,
        thresholdAlarmPercentage: undefined
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
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: limit.value,
        thresholdAlarmPercentage: undefined,
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

  await facadeTest.test('adjustLimits with trx', async (assert) => {
    try {
      const limit = {
        type: 'NET_DEBIT_CAP',
        value: 10000000,
        thresholdAlarmPercentage: undefined
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
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: limit.value,
        thresholdAlarmPercentage: undefined,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1
      }

      const result = await Model.adjustLimits(participant.participantCurrencyId, limit, true)
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
      await Model.adjustLimits(participant.participantCurrencyId, limit, trxStub)
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
    } catch (err) {
      Logger.error(`adjustLimits failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('getParticipantLimitsByCurrencyId', async (assert) => {
    try {
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 1000000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        name: 'NET_DEBIT_CAP'
      }

      const builderStub = sandbox.stub()
      const whereStub = { where: sandbox.stub().returns() }

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

      const result = await Model.getParticipantLimitsByCurrencyId(participant.participantCurrencyId, 'NET_DEBIT_CAP')
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
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 1000000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        name: 'NET_DEBIT_CAP'
      }

      const builderStub = sandbox.stub()
      Db.participantLimit.query.callsArgWith(0, builderStub)
      builderStub.innerJoin = sandbox.stub()
      const whereStub = { where: sandbox.stub().returns() }

      builderStub.innerJoin.returns({
        where: sandbox.stub().returns({
          where: sandbox.stub().callsArgWith(0, whereStub).returns({
            select: sandbox.stub().returns({
              orderBy: sandbox.stub().returns(participantLimit)
            })
          })
        })
      })
      const result = await Model.getParticipantLimitsByCurrencyId(participant.participantCurrencyId)
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
      const builderStub = sandbox.stub()
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
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 1000000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        name: 'NET_DEBIT_CAP'
      }

      const builderStub = sandbox.stub()
      Db.participantLimit.query.callsArgWith(0, builderStub)
      builderStub.innerJoin = sandbox.stub()
      const whereStub = { where: sandbox.stub().returns() }

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
      const result = await Model.getParticipantLimitsByParticipantId(participant.participantId, 1, 'NET_DEBIT_CAP')
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
      const participantLimit = {
        participantCurrencyId: 1,
        participantLimitTypeId: 1,
        value: 1000000,
        isActive: 1,
        createdBy: 'unknown',
        participantLimitId: 1,
        name: 'NET_DEBIT_CAP'
      }

      const builderStub = sandbox.stub()
      Db.participantLimit.query.callsArgWith(0, builderStub)
      builderStub.innerJoin = sandbox.stub()
      const whereStub = { where: sandbox.stub().returns() }

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
      const result = await Model.getParticipantLimitsByParticipantId(participant.participantId)
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
      const builderStub = sandbox.stub()
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

  await facadeTest.test('getParticipantLimitByParticipantCurrencyLimit (cache off)', async (assert) => {
    try {
      const participantLimit = {
        participantId: 1,
        currencyId: 1,
        participantLimitTypeId: 1,
        value: 1000000
      }
      const ledgerAccountTypeId = 1
      const participantLimitTypeId = 1

      const builderStub = sandbox.stub()
      // let whereStub = { where: sandbox.stub().returns() }

      Db.participant.query.callsArgWith(0, builderStub)
      builderStub.where = sandbox.stub()

      builderStub.where.returns({
        innerJoin: sandbox.stub().returns({
          innerJoin: sandbox.stub().returns({
            select: sandbox.stub().returns({
              first: sandbox.stub().returns(participantLimit)
            })
          })
        })
      })

      const result = await Model.getParticipantLimitByParticipantCurrencyLimit(participant.participantId, participant.currency, ledgerAccountTypeId, participantLimitTypeId)
      assert.deepEqual(result, participantLimit)
      assert.end()
    } catch (err) {
      Logger.error(`getParticipantLimitByParticipantCurrencyLimit failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getParticipantLimitByParticipantCurrencyLimit (cache off) should throw error', async (assert) => {
    try {
      const builderStub = sandbox.stub()
      Db.participant.query.callsArgWith(0, builderStub)
      builderStub.innerJoin = sandbox.stub()
      const ledgerAccountTypeId = 1
      const participantLimitTypeId = 1

      builderStub.innerJoin.throws(new Error())
      await Model.getParticipantLimitByParticipantCurrencyLimit(participant.participantId, participant.currency, ledgerAccountTypeId, participantLimitTypeId)
      assert.fail(' should throw')
      assert.end()
    } catch (err) {
      Logger.error(`getParticipantLimitByParticipantCurrencyLimit failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('getParticipantLimitByParticipantCurrencyLimit (cache on)', async (assert) => {
    try {
      /* Setup case for full pass - return of data */
      Cache.isCacheEnabled.returns(true)

      const participantLimitData = {
        participantId: 123,
        currencyId: 456,
        participantLimitTypeId: 789,
        value: 1000000
      }
      const ledgerAccountTypeId = 1
      const participantLimitTypeId = 2

      const setupMockData = () => {
        ParticipantModel.getById.withArgs(participantLimitData.participantId).returns({
          participantId: participantLimitData.participantId,
          isActive: true
        })
        ParticipantCurrencyModel.findOneByParams.returns({
          participantCurrencyId: 321,
          currencyId: participantLimitData.currencyId,
          isActive: true
        })
        ParticipantLimitModel.getByParticipantCurrencyId.withArgs(321).returns({
          isActive: true,
          ...participantLimitData
        })
      }

      const callGetParticipantLimitByParticipantCurrencyLimit = async () => {
        return Model.getParticipantLimitByParticipantCurrencyLimit(
          participantLimitData.participantId,
          participantLimitData.currency,
          ledgerAccountTypeId,
          participantLimitTypeId
        )
      }

      /* Check the data is returned correctly for correct setup of data in cache */
      setupMockData()
      const result = await callGetParticipantLimitByParticipantCurrencyLimit()
      assert.deepEqual(result, participantLimitData, 'should return correct data')

      /* Setup case for failure #1: can't find participant by participantId */
      ParticipantModel.getById.withArgs(participantLimitData.participantId).returns()
      const result2 = await callGetParticipantLimitByParticipantCurrencyLimit()
      assert.deepEqual(result2, undefined, 'should return nothing when cannot find by participantId')

      /* Ensure the data is returned correctly for correct setup of data in cache */
      setupMockData()
      const result3 = await callGetParticipantLimitByParticipantCurrencyLimit()
      assert.deepEqual(result3, participantLimitData, 'should return correct data')

      /* Setup case for failure #2: can't find participantCurrency */
      ParticipantCurrencyModel.findOneByParams.returns()
      const result4 = await callGetParticipantLimitByParticipantCurrencyLimit()
      assert.deepEqual(result4, undefined, 'should return nothing when cannot find participantCurrency')

      /* Ensure the data is returned correctly for correct setup of data in cache */
      setupMockData()
      const result5 = await callGetParticipantLimitByParticipantCurrencyLimit()
      assert.deepEqual(result5, participantLimitData, 'should return correct data')

      /* Setup case for failure #3: can't find participantLimit data */
      ParticipantLimitModel.getByParticipantCurrencyId.withArgs(321).returns()
      const result6 = await callGetParticipantLimitByParticipantCurrencyLimit()
      assert.deepEqual(result6, undefined, 'should return nothing when cannot find participantLimit')

      assert.end()
    } catch (err) {
      Logger.error(`getParticipantLimitByParticipantCurrencyLimit failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getParticipantLimitByParticipantCurrencyLimit returns undefined when participant not found by participantId (cache on)', async (assert) => {
    try {
      Cache.isCacheEnabled.returns(true)

      const participantLimitData = {
        participantId: 123,
        currencyId: 456,
        participantLimitTypeId: 789,
        value: 1000000
      }
      const ledgerAccountTypeId = 1
      const participantLimitTypeId = 2

      ParticipantModel.getById.withArgs(participantLimitData.participantId).returns()

      const result = await Model.getParticipantLimitByParticipantCurrencyLimit(
        participantLimitData.participantId,
        participantLimitData.currency,
        ledgerAccountTypeId,
        participantLimitTypeId
      )
      assert.deepEqual(result, undefined, 'should return undefined')
      assert.end()
    } catch (err) {
      Logger.error(`getParticipantLimitByParticipantCurrencyLimit failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getParticipantLimitByParticipantCurrencyLimit returns undefined when participantCurrency not found by currencyId (cache on)', async (assert) => {
    try {
      Cache.isCacheEnabled.returns(true)

      const participantLimitData = {
        participantId: 123,
        currencyId: 456,
        participantLimitTypeId: 789,
        value: 1000000
      }
      const ledgerAccountTypeId = 1
      const participantLimitTypeId = 2

      ParticipantModel.getById.withArgs(participantLimitData.participantId).returns({
        participantId: participantLimitData.participantId,
        isActive: true
      })
      ParticipantCurrencyModel.findOneByParams.returns()

      const result = await Model.getParticipantLimitByParticipantCurrencyLimit(
        participantLimitData.participantId,
        participantLimitData.currency,
        ledgerAccountTypeId,
        participantLimitTypeId
      )
      assert.deepEqual(result, undefined, 'should return undefined')
      assert.end()
    } catch (err) {
      Logger.error(`getParticipantLimitByParticipantCurrencyLimit failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await facadeTest.test('getParticipantLimitByParticipantCurrencyLimit (cache on) should throw error', async (assert) => {
    try {
      Cache.isCacheEnabled.returns(true)

      const ledgerAccountTypeId = 1
      const participantLimitTypeId = 2

      ParticipantModel.getById.withArgs(participant.participantId).throws(new Error())
      await Model.getParticipantLimitByParticipantCurrencyLimit(participant.participantId, participant.currency, ledgerAccountTypeId, participantLimitTypeId)

      assert.fail('should throw')
      assert.end()
    } catch (err) {
      Logger.error(`getParticipantLimitByParticipantCurrencyLimit failed with error - ${err}`)
      assert.pass('Did throw')
      assert.end()
    }
  })

  await facadeTest.test('addHubAccountAndInitPosition', async (assert) => {
    try {
      const participantPosition = {
        participantCurrencyId: 1,
        value: 0,
        reservedValue: 0,
        participantPositionId: 1
      }

      const participantCurrency = {
        participantCurrencyId: 1,
        participantId: 1,
        currencyId: 1,
        isActive: 1,
        ledgerAccountTypeId: 1,
        createdBy: 'unknown'
      }

      const participant = {
        participantId: 1,
        currencyId: 1,
        ledgerAccountTypeId: 1
      }

      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)
      const transactingStub = sandbox.stub()
      knexStub.returns({
        transacting: transactingStub.returns({
          insert: sandbox.stub().returns([1])
        })
      })
      const result = await Model.addHubAccountAndInitPosition(participant.participantId, participant.currencyId, participant.ledgerAccountTypeId)
      assert.pass('completed successfully')
      assert.ok(knexStub.withArgs('participantCurrency').calledOnce, 'knex called with participantCurrency once')
      assert.ok(knexStub.withArgs('participantPosition').calledOnce, 'knex called with participantPosition once')
      delete result.participantCurrency.createdDate
      assert.deepEqual(result, { participantCurrency, participantPosition })

      knexStub.returns({
        transacting: transactingStub.returns({
          insert: sandbox.stub().throws(new Error())
        })
      })
      try {
        await Model.addHubAccountAndInitPosition(participant.participantId, participant.currencyId, participant.ledgerAccountTypeId)
        assert.fail('Error not thrown!')
      } catch (err) {
        assert.pass('Error thrown')
      }

      Db.getKnex.throws(new Error())
      try {
        await Model.addHubAccountAndInitPosition(participant.participantId, participant.currencyId, participant.ledgerAccountTypeId)
        assert.fail('Error not thrown!')
      } catch (err) {
        assert.pass('Error thrown')
      }

      assert.end()
    } catch (err) {
      console.log(err)
      Logger.error(`addHubAccountAndInitPosition failed with error - ${err}`)
      assert.fail('Error thrown')
      assert.end()
    }
  })

  await facadeTest.test('addNewCurrencyAndPosition should throw an error.', async (assert) => {
    try {
      const participantPosition = {
        participantCurrencyId: 1,
        value: 0,
        reservedValue: 0,
        participantPositionId: 1
      }

      const participantCurrency = {
        participantCurrencyId: 1,
        participantId: 1,
        currencyId: 1,
        ledgerAccountTypeId: 1,
        createdBy: 'unknown'
      }

      const participant = {
        participantId: 1,
        currencyId: 1,
        ledgerAccountTypeId: 1
      }

      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)
      knexStub.throws(new Error())

      const result = await Model.addNewCurrencyAndPosition(participant.participantId, participant.currencyId, participant.ledgerAccountTypeId)
      assert.pass('completed successfully')
      assert.ok(knexStub.withArgs('participantCurrency').calledOnce, 'knex called with participantCurrency once')
      assert.ok(knexStub.withArgs('participantPosition').calledOnce, 'knex called with participantPosition once')
      assert.deepEqual(result, { participantCurrency, participantPosition })

      assert.end()
    } catch (err) {
      assert.pass('Error thrown')
      assert.end()
    }
  })
  await facadeTest.test('getAllAccountsByNameAndCurrency should return the participant accounts for given currency', async (test) => {
    try {
      const participantName = 'fsp1'
      const currencyId = 'USD'
      const builderStub = sandbox.stub()

      builderStub.innerJoin = sandbox.stub()
      const whereStub = { where: sandbox.stub().returns() }
      Db.participantCurrency.query.callsArgWith(0, builderStub)
      const participantCurrency = {
        participantCurrencyId: 1,
        participantId: 1,
        currencyId: 'USD',
        isActive: 1
      }
      builderStub.innerJoin.returns({
        innerJoin: sandbox.stub().returns({
          where: sandbox.stub().returns({
            where: sandbox.stub().callsArgWith(0, whereStub).returns({
              where: sandbox.stub().callsArgWith(0, whereStub).returns({
                select: sandbox.stub().returns(participantCurrency)
              })
            })
          })
        })
      })

      const found = await Model.getAllAccountsByNameAndCurrency(participantName, currencyId)
      test.deepEqual(found, participantCurrency, 'retrieve the record')
      test.ok(builderStub.innerJoin.withArgs('ledgerAccountType AS lap', 'lap.ledgerAccountTypeId', 'participantCurrency.ledgerAccountTypeId').calledOnce, 'query builder called once')
      test.end()
    } catch (err) {
      Logger.error(`getAllByNameAndCurrency failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await facadeTest.test('getAllAccountsByNameAndCurrency should return the participant accounts regardless the isActive state', async (test) => {
    try {
      const participantName = 'fsp1'
      const currency = 'USD'
      const isAccountActive = null
      const builderStub = sandbox.stub()

      builderStub.innerJoin = sandbox.stub()
      const whereStub = { where: sandbox.stub().returns() }
      Db.participantCurrency.query.callsArgWith(0, builderStub)
      const participantCurrency = {
        participantCurrencyId: 1,
        participantId: 1,
        currencyId: 'USD',
        isActive: 1
      }
      builderStub.innerJoin.returns({
        innerJoin: sandbox.stub().returns({
          where: sandbox.stub().returns({
            where: sandbox.stub().callsArgWith(0, whereStub).returns({
              where: sandbox.stub().callsArgWith(0, whereStub).returns({
                select: sandbox.stub().returns(participantCurrency)
              })
            })
          })
        })
      })

      const found = await Model.getAllAccountsByNameAndCurrency(participantName, currency, isAccountActive)
      test.deepEqual(found, participantCurrency, 'retrieve the record')
      test.ok(builderStub.innerJoin.withArgs('ledgerAccountType AS lap', 'lap.ledgerAccountTypeId', 'participantCurrency.ledgerAccountTypeId').calledOnce, 'query builder called once')
      test.end()
    } catch (err) {
      Logger.error(`getAllByNameAndCurrency failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await facadeTest.test('getAllAccountsByNameAndCurrency should return the participant accounts for any', async (test) => {
    try {
      const participantName = 'fsp1'
      const builderStub = sandbox.stub()

      builderStub.innerJoin = sandbox.stub()
      const whereStub = { where: sandbox.stub().returns() }
      Db.participantCurrency.query.callsArgWith(0, builderStub)
      const participantCurrency = {
        participantCurrencyId: 1,
        participantId: 1,
        currencyId: 'USD',
        isActive: 1
      }
      builderStub.innerJoin.returns({
        innerJoin: sandbox.stub().returns({
          where: sandbox.stub().returns({
            where: sandbox.stub().callsArgWith(0, whereStub).returns({
              where: sandbox.stub().callsArgWith(0, whereStub).returns({
                select: sandbox.stub().returns(participantCurrency)
              })
            })
          })
        })
      })

      const found = await Model.getAllAccountsByNameAndCurrency(participantName)
      test.deepEqual(found, participantCurrency, 'retrieve the record')
      test.ok(builderStub.innerJoin.withArgs('ledgerAccountType AS lap', 'lap.ledgerAccountTypeId', 'participantCurrency.ledgerAccountTypeId').calledOnce, 'query builder called once')
      test.end()
    } catch (err) {
      Logger.error(`getAllByNameAndCurrency failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await facadeTest.test('getAllAccountsByNameAndCurrency should throw error', async (test) => {
    try {
      const participantName = 'dfsp1'

      Db.participantCurrency.query.throws(new Error())

      await Model.getAllAccountsByNameAndCurrency(participantName)
      test.fail(' should throw')
      test.end()
      test.end()
    } catch (err) {
      Logger.error(`Model.getAllAccountsByNameAndCurrency failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await facadeTest.test('getLimitsForAllParticipants should', async (test) => {
    try {
      const type = 'NET_DEBIT_CAP'
      const currencyId = 'USD'
      const ledgerAccountTypeId = 1
      const builderStub = sandbox.stub()
      const participantCurrencyStub = sandbox.stub()
      const participantLimitStub = sandbox.stub()
      const participantLimitTypeStub = sandbox.stub()
      const selectStub = sandbox.stub()
      const whereStub1 = { where: sandbox.stub().returns() }
      const whereStub2 = { where: sandbox.stub().returns() }

      builderStub.where = sandbox.stub()
      Db.participant.query.callsArgWith(0, builderStub)

      builderStub.where.returns({
        where: sandbox.stub().callsArgWith(0, whereStub1).returns({
          innerJoin: participantCurrencyStub.returns({
            innerJoin: participantLimitStub.returns({
              where: sandbox.stub().returns({
                where: sandbox.stub().callsArgWith(0, whereStub2).returns({
                  innerJoin: participantLimitTypeStub.returns({
                    select: selectStub.returns(1)
                  })
                })
              })
            })
          })
        })
      })

      const found = await Model.getLimitsForAllParticipants(currencyId, type, ledgerAccountTypeId)
      test.equal(found, 1, 'retrieve the record')
      test.ok(builderStub.where.withArgs({
        'pc.ledgerAccountTypeId': ledgerAccountTypeId,
        'participant.isActive': 1,
        'pc.isActive': 1
      }).calledOnce, 'query builder called once')
      test.ok(participantCurrencyStub.withArgs('participantCurrency AS pc', 'pc.participantId', 'participant.participantId').calledOnce, 'participantCurrency inner joined')
      test.ok(participantLimitStub.withArgs('participantLimit AS pl', 'pl.participantCurrencyId', 'pc.participantCurrencyId').calledOnce, 'participantLimit inner joined')
      test.ok(participantLimitTypeStub.withArgs('participantLimitType AS lt', 'lt.participantLimitTypeId', 'pl.participantLimitTypeId').calledOnce, 'participantLimitType inner joined')
      test.ok(selectStub.withArgs(
        'participant.*',
        'pc.*',
        'pl.*',
        'lt.name as limitType'
      ).calledOnce, 'select all columns from participant, participantCurrency and participantLimit')
      test.end()
    } catch (err) {
      Logger.error(`getLimitsForAllParticipants failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await facadeTest.test('getLimitsForAllParticipants should return when the currency and type is null', async (test) => {
    try {
      const type = null
      const currencyId = null
      const ledgerAccountTypeId = 1
      const builderStub = sandbox.stub()
      const participantCurrencyStub = sandbox.stub()
      const participantLimitStub = sandbox.stub()
      const participantLimitTypeStub = sandbox.stub()
      const selectStub = sandbox.stub()
      const whereStub1 = { where: sandbox.stub().returns() }
      const whereStub2 = { where: sandbox.stub().returns() }

      builderStub.where = sandbox.stub()
      Db.participant.query.callsArgWith(0, builderStub)

      builderStub.where.returns({
        where: sandbox.stub().callsArgWith(0, whereStub1).returns({
          innerJoin: participantCurrencyStub.returns({
            innerJoin: participantLimitStub.returns({
              where: sandbox.stub().returns({
                where: sandbox.stub().callsArgWith(0, whereStub2).returns({
                  innerJoin: participantLimitTypeStub.returns({
                    select: selectStub.returns(1)
                  })
                })
              })
            })
          })
        })
      })

      const found = await Model.getLimitsForAllParticipants(currencyId, type, ledgerAccountTypeId)
      test.equal(found, 1, 'retrieve the record')
      test.ok(builderStub.where.withArgs({
        'pc.ledgerAccountTypeId': ledgerAccountTypeId,
        'participant.isActive': 1,
        'pc.isActive': 1
      }).calledOnce, 'query builder called once')
      test.ok(participantCurrencyStub.withArgs('participantCurrency AS pc', 'pc.participantId', 'participant.participantId').calledOnce, 'participantCurrency inner joined')
      test.ok(participantLimitStub.withArgs('participantLimit AS pl', 'pl.participantCurrencyId', 'pc.participantCurrencyId').calledOnce, 'participantLimit inner joined')
      test.ok(participantLimitTypeStub.withArgs('participantLimitType AS lt', 'lt.participantLimitTypeId', 'pl.participantLimitTypeId').calledOnce, 'participantLimitType inner joined')
      test.ok(selectStub.withArgs(
        'participant.*',
        'pc.*',
        'pl.*',
        'lt.name as limitType'
      ).calledOnce, 'select all columns from participant, participantCurrency and participantLimit')
      test.end()
    } catch (err) {
      Logger.error(`getLimitsForAllParticipants failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await facadeTest.test('getLimitsForAllParticipants should', async (test) => {
    try {
      const type = 'NET_DEBIT_CAP'
      const currencyId = 'USD'
      const ledgerAccountTypeId = 1
      Db.participant.query.throws(new Error())

      await Model.getLimitsForAllParticipants(currencyId, type, ledgerAccountTypeId)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`getLimitsForAllParticipants failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })
  await facadeTest.test('getAllNonHubParticipantsWithCurrencies should', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = {
        get commit () {

        },
        get rollback () {

        }
      }
      const trxSpyCommit = sandbox.spy(trxStub, 'commit', ['get'])

      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)
      const transactingStub = sandbox.stub()
      const distinctStub = sandbox.stub()
      const fromStub = sandbox.stub()
      const innerJoinStub = sandbox.stub()
      const whereNotStub = sandbox.stub()
      const participantsWithCurrencies = [{
        participantId: 1,
        currencyId: 'USD'
      }]
      transactingStub.resolves(participantsWithCurrencies)
      whereNotStub.returns({ transacting: transactingStub })
      innerJoinStub.returns({ whereNot: whereNotStub })
      fromStub.returns({ innerJoin: innerJoinStub })
      knexStub.distinct = distinctStub.returns({ from: fromStub })

      const response = await Model.getAllNonHubParticipantsWithCurrencies(trxStub)
      test.equal(whereNotStub.lastCall.args[0], 'participant.name', 'filter on participants name')
      test.equal(whereNotStub.lastCall.args[1], 'Hub', 'filter out the Hub')
      test.equal(transactingStub.lastCall.args[0], trxStub, 'run as transaction')
      test.equal(trxSpyCommit.get.calledOnce, false, 'not commit the transaction if transaction is passed')
      test.deepEqual(response, participantsWithCurrencies, 'return participants with currencies')
      test.end()
    } catch (err) {
      Logger.error(`getAllNonHubParticipantsWithCurrencies failed with error - ${err}`)
      test.fail('Error thrown')
      test.end()
    }
  })

  await facadeTest.test('getAllNonHubParticipantsWithCurrencies should', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = {
        get commit () {

        },
        get rollback () {

        }
      }
      const trxSpyCommit = sandbox.spy(trxStub, 'commit', ['get'])

      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)
      const transactingStub = sandbox.stub()
      const distinctStub = sandbox.stub()
      const fromStub = sandbox.stub()
      const innerJoinStub = sandbox.stub()
      const whereNotStub = sandbox.stub()
      const participantsWithCurrencies = [{
        participantId: 1,
        currencyId: 'USD'
      }]
      transactingStub.resolves(participantsWithCurrencies)
      whereNotStub.returns({ transacting: transactingStub })
      innerJoinStub.returns({ whereNot: whereNotStub })
      fromStub.returns({ innerJoin: innerJoinStub })
      knexStub.distinct = distinctStub.returns({ from: fromStub })

      const response = await Model.getAllNonHubParticipantsWithCurrencies()
      test.equal(whereNotStub.lastCall.args[0], 'participant.name', 'filter on participants name')
      test.equal(whereNotStub.lastCall.args[1], 'Hub', 'filter out the Hub')
      test.equal(transactingStub.lastCall.args[0], trxStub, 'run as transaction')
      test.equal(trxSpyCommit.get.calledOnce, true, 'commit the transaction if no transaction is passed')

      test.deepEqual(response, participantsWithCurrencies, 'return participants with currencies')
      test.end()
    } catch (err) {
      Logger.error(`getAllNonHubParticipantsWithCurrencies failed with error - ${err}`)
      test.fail('Error thrown')
      test.end()
    }
  })

  await facadeTest.test('getAllNonHubParticipantsWithCurrencies should', async (test) => {
    let trxStub
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      trxStub.rollback = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)
      const transactingStub = sandbox.stub()
      const distinctStub = sandbox.stub()
      const fromStub = sandbox.stub()
      const innerJoinStub = sandbox.stub()
      const whereNotStub = sandbox.stub()

      transactingStub.rejects(new Error())
      whereNotStub.returns({ transacting: transactingStub })
      innerJoinStub.returns({ whereNot: whereNotStub })
      fromStub.returns({ innerJoin: innerJoinStub })
      knexStub.distinct = distinctStub.returns({ from: fromStub })
      await Model.getAllNonHubParticipantsWithCurrencies()
      test.fail('have thrown an error')
      test.end()
    } catch (err) {
      test.pass('throw an error')
      test.equal(trxStub.rollback.callCount, 0, 'not rollback the transaction if transaction is passed')
      test.end()
    }
  })

  await facadeTest.test('getAllNonHubParticipantsWithCurrencies should', async (test) => {
    try {
      sandbox.stub(Db, 'getKnex')
      Db.getKnex.throws(new Error())
      await Model.getAllNonHubParticipantsWithCurrencies()
      test.fail('have thrown an error')
      test.end()
    } catch (err) {
      test.pass('throw an error')
      test.end()
    }
  })

  await facadeTest.end()
})
