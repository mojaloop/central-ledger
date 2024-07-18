'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const ParticipantService = require('../../../src/domain/participant')
const Proxyquire = require('proxyquire')

const connectStub = Sinon.stub()
const disconnectStub = Sinon.stub()
const lookupProxyByDfspIdStub = Sinon.stub()
lookupProxyByDfspIdStub.withArgs('existingDfspId1').resolves('proxyId')
lookupProxyByDfspIdStub.withArgs('existingDfspId2').resolves('proxyId')
lookupProxyByDfspIdStub.withArgs('existingDfspId3').resolves('proxyId1')
lookupProxyByDfspIdStub.withArgs('nonExistingDfspId1').resolves(null)
lookupProxyByDfspIdStub.withArgs('nonExistingDfspId2').resolves(null)

const ProxyCache = Proxyquire('../../../src/lib/proxyCache', {
  '@mojaloop/inter-scheme-proxy-cache-lib': {
    createProxyCache: Sinon.stub().returns({
      connect: connectStub,
      disconnect: disconnectStub,
      lookupProxyByDfspId: lookupProxyByDfspIdStub
    })
  }
})

Test('Proxy Cache test', async (proxyCacheTest) => {
  let sandbox

  proxyCacheTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(ParticipantService)
    t.end()
  })

  proxyCacheTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await proxyCacheTest.test('connect', async (connectTest) => {
    await connectTest.test('connect to cache', async (test) => {
      await ProxyCache.connect()
      Sinon.assert.calledOnce(connectStub)
      test.end()
    })

    connectTest.end()
  })

  await proxyCacheTest.test('disconnect', async (disconnectTest) => {
    await disconnectTest.test('disconnect from cache', async (test) => {
      await ProxyCache.disconnect()
      Sinon.assert.calledOnce(disconnectStub)
      test.end()
    })

    disconnectTest.end()
  })

  await proxyCacheTest.test('getCache', async (getCacheTest) => {
    await getCacheTest.test('resolve proxy id if participant not in scheme and proxyId is in cache', async (test) => {
      await ProxyCache.getCache()
      test.pass()
      test.end()
    })
    getCacheTest.end()
  })

  await proxyCacheTest.test('getFSPProxy', async (getFSPProxyTest) => {
    await getFSPProxyTest.test('resolve proxy id if participant not in scheme and proxyId is in cache', async (test) => {
      ParticipantService.getByName.returns(Promise.resolve(null))
      const result = await ProxyCache.getFSPProxy('existingDfspId1')

      test.deepEqual(result, { inScheme: false, proxyId: 'proxyId' })
      test.end()
    })

    await getFSPProxyTest.test('resolve proxy id if participant not in scheme and proxyId is not cache', async (test) => {
      ParticipantService.getByName.returns(Promise.resolve(null))
      const result = await ProxyCache.getFSPProxy('nonExistingDfspId1')

      test.deepEqual(result, { inScheme: false, proxyId: null })
      test.end()
    })

    await getFSPProxyTest.test('not resolve proxyId if participant is in scheme', async (test) => {
      ParticipantService.getByName.returns(Promise.resolve({ participantId: 1 }))
      const result = await ProxyCache.getFSPProxy('existingDfspId1')

      test.deepEqual(result, { inScheme: true, proxyId: null })
      test.end()
    })

    getFSPProxyTest.end()
  })

  await proxyCacheTest.test('checkSameCreditorDebtorProxy', async (checkSameCreditorDebtorProxyTest) => {
    await checkSameCreditorDebtorProxyTest.test('resolve true if proxy of debtor and creditor are truth and the same', async (test) => {
      const result = await ProxyCache.checkSameCreditorDebtorProxy('existingDfspId1', 'existingDfspId2')
      test.deepEqual(result, true)
      test.end()
    })

    await checkSameCreditorDebtorProxyTest.test('resolve false if proxy of debtor and creditor are truth and different', async (test) => {
      const result = await ProxyCache.checkSameCreditorDebtorProxy('existingDfspId1', 'existingDfspId3')
      test.deepEqual(result, false)
      test.end()
    })

    await checkSameCreditorDebtorProxyTest.test('resolve false if proxy of debtor and creditor are same but falsy', async (test) => {
      const result = await ProxyCache.checkSameCreditorDebtorProxy('nonExistingDfspId1', 'nonExistingDfspId1')
      test.deepEqual(result, false)
      test.end()
    })

    checkSameCreditorDebtorProxyTest.end()
  })

  proxyCacheTest.end()
})
