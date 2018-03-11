'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const Config = require('../../../../src/lib/config')
const Handler = require('../../../../src/admin/transfers/handler')
const Transfer = require('../../../../src/domain/transfer')
const Sidecar = require('../../../../src/lib/sidecar')

Test('transfers handler', handlerTest => {
  let sandbox
  let originalHostName
  let hostname = 'http://some-host'

  handlerTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    originalHostName = Config.HOSTNAME
    Config.HOSTNAME = hostname
    sandbox.stub(Transfer)
    sandbox.stub(Sidecar, 'logRequest')
    t.end()
  })

  handlerTest.afterEach(t => {
    Config.HOSTNAME = originalHostName
    sandbox.restore()
    t.end()
  })

  handlerTest.test('getAll should', getAllTest => {
    getAllTest.test('get all transfers and format list', async function (test) {
      const transfer1 = {
        transferUuid: '90b5af57-256c-4b85-b2e1-cf6975c1a4b8',
        state: 'executed',
        debitAmount: '1200'
      }
      const transfer2 = {
        transferUuid: '90b5af57-256c-4b85-b2e1-cf6975c1a4b9',
        state: 'executed',
        debitAmount: '1300'
      }
      const transfers = [transfer1, transfer2]

      Transfer.getAll.returns(P.resolve(transfers))

      const response = await Handler.getAll({}, {})
      test.equal(response.length, 2)
      const item1 = response[0]
      test.equal(item1.transferUuid, transfer1.transferUuid)
      test.equal(item1.state, transfer1.state)
      const item2 = response[1]
      test.equal(item2.transferUuid, transfer2.transferUuid)
      test.equal(item2.state, transfer2.state)
      test.end()
    })

    getAllTest.test('reply with error if Transfer service throws', async function (test) {
      const error = new Error()
      Transfer.getAll.returns(P.reject(error))
      try {
        await Handler.getAll({}, {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    getAllTest.end()
  })

  handlerTest.end()
})
