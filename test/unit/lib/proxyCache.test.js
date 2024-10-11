'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Proxyquire = require('proxyquire')
const ParticipantService = require('../../../src/domain/participant')
const Config = require('../../../src/lib/config')

const connectStub = Sinon.stub()
const disconnectStub = Sinon.stub()
const lookupProxyByDfspIdStub = Sinon.stub()
lookupProxyByDfspIdStub.withArgs('existingDfspId1').resolves('proxyId')
lookupProxyByDfspIdStub.withArgs('existingDfspId2').resolves('proxyId')
lookupProxyByDfspIdStub.withArgs('existingDfspId3').resolves('proxyId1')
lookupProxyByDfspIdStub.withArgs('nonExistingDfspId1').resolves(null)
lookupProxyByDfspIdStub.withArgs('nonExistingDfspId2').resolves(null)

const createProxyCacheStub = Sinon.stub().returns({
  connect: connectStub,
  disconnect: disconnectStub,
  lookupProxyByDfspId: lookupProxyByDfspIdStub
})
const ProxyCache = Proxyquire('../../../src/lib/proxyCache', {
  '@mojaloop/inter-scheme-proxy-cache-lib': {
    createProxyCache: createProxyCacheStub
  }
})

Test('Proxy Cache test', async (proxyCacheTest) => {
  let sandbox

  proxyCacheTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Config.PROXY_CACHE_CONFIG, 'type')
    sandbox.stub(Config.PROXY_CACHE_CONFIG, 'proxyConfig')
    sandbox.stub(ParticipantService)
    t.end()
  })

  proxyCacheTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await proxyCacheTest.test('connect', async (connectTest) => {
    await connectTest.test('connect to cache with lazyConnect', async (test) => {
      await ProxyCache.connect()
      test.ok(connectStub.calledOnce)
      test.end()
    })

    await connectTest.test('connect to cache with default config if not redis storage type', async (test) => {
      await ProxyCache.reset()
      connectStub.resetHistory()
      createProxyCacheStub.resetHistory()
      Config.PROXY_CACHE_CONFIG.type = 'mysql'
      await ProxyCache.connect()
      test.ok(connectStub.calledOnce)
      const secondArg = createProxyCacheStub.getCall(0).args[1]
      test.ok(secondArg.lazyConnect === undefined)
      test.end()
    })

    connectTest.end()
  })

  await proxyCacheTest.test('disconnect', async (disconnectTest) => {
    await disconnectTest.test('disconnect from cache', async (test) => {
      await ProxyCache.disconnect()
      test.pass()
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
      const dfspId = 'existingDfspId1'
      const result = await ProxyCache.getFSPProxy(dfspId)

      test.deepEqual(result, { inScheme: false, proxyId: 'proxyId', name: dfspId })
      test.end()
    })

    await getFSPProxyTest.test('resolve proxy id if participant not in scheme and proxyId is not cache', async (test) => {
      ParticipantService.getByName.returns(Promise.resolve(null))
      const dsfpId = 'nonExistingDfspId1'
      const result = await ProxyCache.getFSPProxy(dsfpId)

      test.deepEqual(result, { inScheme: false, proxyId: null, name: dsfpId })
      test.end()
    })

    await getFSPProxyTest.test('not resolve proxyId if participant is in scheme', async (test) => {
      ParticipantService.getByName.returns(Promise.resolve({ participantId: 1 }))
      const result = await ProxyCache.getFSPProxy('existingDfspId1')

      test.deepEqual(result, { inScheme: true, proxyId: null, name: 'existingDfspId1' })
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

  await proxyCacheTest.test('getProxyParticipantAccountDetails', async (getProxyParticipantAccountDetailsTest) => {
    await getProxyParticipantAccountDetailsTest.test('resolve participantCurrencyId if participant is in scheme', async (test) => {
      ParticipantService.getByName.returns(Promise.resolve({ participantId: 1 }))
      ParticipantService.getAccountByNameAndCurrency.returns(Promise.resolve({ participantCurrencyId: 123 }))
      const result = await ProxyCache.getProxyParticipantAccountDetails('nonExistingDfspId1', 'XXX')
      test.deepEqual(result, { inScheme: true, participantCurrencyId: 123 })
      test.end()
    })

    await getProxyParticipantAccountDetailsTest.test('resolve participantCurrencyId of the proxy if participant is not in scheme', async (test) => {
      ParticipantService.getByName.returns(Promise.resolve(null))
      ParticipantService.getAccountByNameAndCurrency.returns(Promise.resolve({ participantCurrencyId: 456 }))
      const result = await ProxyCache.getProxyParticipantAccountDetails('existingDfspId1', 'XXX')
      test.deepEqual(result, { inScheme: false, participantCurrencyId: 456 })
      test.end()
    })

    await getProxyParticipantAccountDetailsTest.test('resolve null if participant is in scheme and there is no account', async (test) => {
      ParticipantService.getByName.returns(Promise.resolve({ participantId: 1 }))
      ParticipantService.getAccountByNameAndCurrency.returns(Promise.resolve(null))
      const result = await ProxyCache.getProxyParticipantAccountDetails('nonExistingDfspId1', 'XXX')
      test.deepEqual(result, { inScheme: true, participantCurrencyId: null })
      test.end()
    })

    await getProxyParticipantAccountDetailsTest.test('resolve null if participant is not in scheme and also there is no proxy in cache', async (test) => {
      ParticipantService.getByName.returns(Promise.resolve(null))
      const result = await ProxyCache.getProxyParticipantAccountDetails('nonExistingDfspId1', 'XXX')
      test.deepEqual(result, { inScheme: false, participantCurrencyId: null })
      test.end()
    })

    await getProxyParticipantAccountDetailsTest.test('resolve null if participant is not in scheme and proxy exists but no account', async (test) => {
      ParticipantService.getByName.returns(Promise.resolve(null))
      ParticipantService.getAccountByNameAndCurrency.returns(Promise.resolve(null))
      const result = await ProxyCache.getProxyParticipantAccountDetails('existingDfspId1', 'XXX')
      test.deepEqual(result, { inScheme: false, participantCurrencyId: null })
      test.end()
    })

    getProxyParticipantAccountDetailsTest.end()
  })

  proxyCacheTest.end()
})
