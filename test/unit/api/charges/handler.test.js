'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const Config = require('../../../../src/lib/config')
const Handler = require('../../../../src/api/charge/handler')
const Charge = require('../../../../src/domain/charge')

Test('charge handler', handlerTest => {
  let sandbox
  let originalHostName
  let hostname = 'http://some-host'

  handlerTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    originalHostName = Config.HOSTNAME
    Config.HOSTNAME = hostname
    sandbox.stub(Charge, 'quote')
    t.end()
  })

  handlerTest.afterEach(t => {
    Config.HOSTNAME = originalHostName
    sandbox.restore()
    t.end()
  })

  handlerTest.test('chargeQuote should', chargeQuoteTest => {
    chargeQuoteTest.test('get all charge quotes and format charge quote list', async function (test) {
      const chargeQuote1 = {
        name: 'charge1',
        charge_type: 'flat',
        code: '001',
        amount: '12.75'
      }
      const chargeQuote2 = {
        name: 'charge2',
        charge_type: 'percent',
        code: '002',
        amount: '1.50'
      }
      const charge = [chargeQuote1, chargeQuote2]

      Charge.quote.returns(P.resolve(charge))
      const response = await Handler.chargeQuote({}, {})
      test.equal(response.length, 2)
      const item1 = response[0]
      test.equal(item1.name, chargeQuote1.name)
      test.equal(item1.charge_type, chargeQuote1.charge_type)
      test.equal(item1.code, chargeQuote1.code)
      test.equal(item1.amount, chargeQuote1.amount)
      const item2 = response[1]
      test.equal(item2.name, chargeQuote2.name)
      test.equal(item2.charge_type, chargeQuote2.charge_type)
      test.equal(item2.code, chargeQuote2.code)
      test.equal(item2.amount, chargeQuote2.amount)
      test.end()
    })

    chargeQuoteTest.test('reply with error if Charge services throws', async function (test) {
      const error = new Error()
      Charge.quote.returns(P.reject(error))
      try {
        await Handler.chargeQuote({}, {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    chargeQuoteTest.end()
  })

  handlerTest.end()
})
