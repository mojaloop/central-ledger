'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Eventric = require('eventric')
const P = require('bluebird')
const Index = require('../../../src/eventric/index')
const KnexStore = require('../../../src/eventric/knex-store')
const Transfer = require('../../../src/eventric/transfer')

Test('Eventric index', indexTest => {
  let sandbox

  indexTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Eventric, 'context')
    sandbox.stub(Eventric, 'setStore')
    sandbox.stub(Transfer, 'setupContext')
    t.end()
  })

  indexTest.afterEach(t => {
    sandbox.restore()

    t.end()
  })

  indexTest.test('getContext should', ctxTest => {
    ctxTest.test('Setup default store and configure transfer only once', t => {
      let stubCtx = {
        initialize: () => P.resolve()
      }

      Eventric.context.returns(stubCtx)

      Index.getContext()
      .then(ctx => {
        t.ok(Eventric.setStore.calledWith(KnexStore.default, {}))
        t.ok(Transfer.setupContext.calledWith(stubCtx))
      })
      .then(() => {
        Eventric.setStore.reset()
        Transfer.setupContext.reset()
        return Index.getContext()
      })
      .then(() => {
        t.ok(Eventric.setStore.notCalled)
        t.ok(Transfer.setupContext.notCalled)
        t.end()
      })
    })
    ctxTest.end()
  })

  indexTest.end()
})
