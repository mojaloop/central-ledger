'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const Model = require('../../../../src/models/participant/participantProxy')

Test('Participant Proxy model', async (participantProxyTest) => {
  let sandbox

  participantProxyTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.participantProxy = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      destroy: sandbox.stub(),
      update: sandbox.stub()
    }
    Db.from = (table) => {
      return Db[table]
    }
    t.end()
  })

  participantProxyTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await participantProxyTest.test('create participant Proxy', async (assert) => {
    try {
      const participantId = 1
      const isProxy = true
      Db.participantProxy.insert.withArgs({ participantId, isProxy }).returns(1)
      const result = await Model.create(participantId, isProxy)
      assert.equal(result, 1, `returns ${result}`)
      assert.end()
    } catch (err) {
      Logger.error(`create participant proxy failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantProxyTest.test('create participant proxy should throw an error', async (assert) => {
    Db.participantProxy.insert.throws(new Error('message'))
    try {
      const result = await Model.create({ participantId: 1, proxyId: 'USD', createdBy: 'unknown' })
      assert.comment(result)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error)
      Logger.error(`create participant proxy failed with error - ${err}`)
      assert.pass('Error thrown')
    }
    assert.end()
  })

  await participantProxyTest.test('checkParticipantProxy', async (assert) => {
    try {
      Db.participantProxy.findOne.withArgs({ participantId: 5, isProxy: 1 }).returns(1)
      const result = await Model.checkParticipantProxy(5)
      assert.equal(result, 1)
      assert.end()
    } catch (err) {
      Logger.error(`get participant proxy by Id failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantProxyTest.test('checkParticipantProxy returns falsy on no record', async (assert) => {
    try {
      Db.participantProxy.findOne.withArgs({ participantId: 5, isProxy: 1 }).returns(null)
      const result = await Model.checkParticipantProxy(5)
      assert.equal(result, 0)
      assert.end()
    } catch (err) {
      Logger.error(`get participant proxy by Id failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantProxyTest.test('getById should fail', async (test) => {
    try {
      Db.participantProxy.findOne.withArgs({ participantId: 5, isProxy: 1 }).throws(new Error())
      await Model.checkParticipantProxy(5)
      test.fail('Error not thrown')
      test.end()
    } catch (err) {
      Logger.error(`get participant proxy by Id failed with error - ${err}`)
      test.pass('Error thrown')
      test.end()
    }
  })

  await participantProxyTest.test('destroyByParticipantId', async (assert) => {
    try {
      Db.participantProxy.destroy.withArgs({ participantId: 1 }).returns(Promise.resolve(true))
      const result = await Model.destroyByParticipantId(1)
      assert.equal(result, true)
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`destroy participant failed with error - ${err}`)
      sandbox.restore()
      assert.fail()
      assert.end()
    }
  })

  await participantProxyTest.test('destroyByParticipantId should throw an error', async (test) => {
    try {
      Db.participantProxy.destroy.withArgs({ participantId: 1 }).throws(new Error())
      const result = await Model.destroyByParticipantId(1)
      test.equal(result, true)
      test.fail('Error not thrown')
      sandbox.restore()
      test.end()
    } catch (err) {
      Logger.error(`destroy participant failed with error - ${err}`)
      test.pass('Error thrown')
      sandbox.restore()
      test.end()
    }
  })

  participantProxyTest.end()
})
