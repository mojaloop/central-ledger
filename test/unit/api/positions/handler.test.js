'use strict'

const src = '../../../../src'
const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const Handler = require(`${src}/api/positions/handler`)
const PositionService = require(`${src}/domain/position`)
const Account = require(`${src}/domain/account`)

Test('positions handler', (handlerTest) => {
  let sandbox
  let hostname = 'http://some-host'

  handlerTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(PositionService, 'calculateForAllAccounts')
    sandbox.stub(PositionService, 'calculateForAccount')
    sandbox.stub(Account, 'getByName')
    t.end()
  })

  handlerTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  handlerTest.test('calculateForAllAccounts should', (performTest) => {
    performTest.test('return no positions if there are no settleable transfers', async function (test) {
      PositionService.calculateForAllAccounts.returns(P.resolve([]))

      let expectedResponse = {positions: []}
      let reply = {
        response: (response) => {
          test.ok(PositionService.calculateForAllAccounts.calledOnce)
          test.deepEqual(response, expectedResponse)
          test.end()
        }
      }
      await Handler.calculateForAllAccounts('', reply)
    })

    performTest.test('return expected positions if settleable transfers exist', async function (test) {
      let positions = [{
        account: `${hostname}/accounts/account1`,
        payments: '5',
        receipts: '0',
        net: '-5'
      },
        {
          account: `${hostname}/accounts/account2`,
          payments: '0',
          receipts: '3',
          net: '3'
        },
        {
          account: `${hostname}/accounts/account3`,
          payments: '0',
          receipts: '2',
          net: '2'
        }
      ]

      PositionService.calculateForAllAccounts.returns(P.resolve(positions))
      let expectedResponse = {positions: positions}

      let reply = {
        response: (response) => {
          test.ok(PositionService.calculateForAllAccounts.calledOnce)
          test.deepEqual(response, expectedResponse)
          test.end()
        }
      }
      await Handler.calculateForAllAccounts('', reply)
    })
    performTest.end()
  })

  handlerTest.test('calculateForAccount should', (performTest) => {
    performTest.test('return positions if there are no settleable transfers or fee', async function (test) {
      PositionService.calculateForAccount.returns(P.resolve({}))
      Account.getByName.returns(P.resolve({accountId: 11}))
      const response = await Handler.calculateForAccount({params: {name: 'dfsp1'}}, {})
      test.ok(PositionService.calculateForAccount.calledOnce)
      test.deepEqual(response, [])
      test.end()
    })

    performTest.test('return expected position if settleable transfers and fee exist', async function (test) {
      let positions = {
        account: `${hostname}/accounts/dfsp1`,
        fee: {
          payments: 4,
          receipts: 0,
          net: -4
        },
        transfers: {
          payments: 40,
          receipts: 0,
          net: -40
        },
        net: -44
      }

      PositionService.calculateForAccount.returns(P.resolve(positions))
      Account.getByName.returns(P.resolve({accountId: 11}))
      const response = await Handler.calculateForAccount({params: {name: 'dfsp1'}}, {})
      test.ok(PositionService.calculateForAccount.calledOnce)
      test.deepEqual(response, positions)
      test.end()
    })
    performTest.end()
  })

  handlerTest.end()
})
