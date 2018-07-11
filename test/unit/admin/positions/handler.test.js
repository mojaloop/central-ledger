'use strict'

const src = '../../../../src'
const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const Handler = require(`${src}/admin/positions/handler`)
const PositionService = require(`${src}/domain/position`)
const Participant = require(`${src}/domain/participant`)

Test('positions handler', (handlerTest) => {
  let sandbox
  let hostname = 'http://some-host'

  handlerTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(PositionService, 'calculateForAllParticipants')
    sandbox.stub(PositionService, 'calculateForParticipant')
    sandbox.stub(Participant, 'getByName')
    t.end()
  })

  handlerTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  handlerTest.test('calculateForAllParticipants should', (performTest) => {
    performTest.test('return no positions if there are no settleable transfers', async function (test) {
      PositionService.calculateForAllParticipants.returns(P.resolve([]))

      let expectedResponse = { positions: [] }
      let reply = {
        response: (output) => {
          test.ok(PositionService.calculateForAllParticipants.calledOnce)
          test.deepEqual(output, expectedResponse)
          test.end()
        }
      }
      await Handler.calculateForAllParticipants('', reply)
    })

    performTest.test('return expected positions if settleable transfers exist', async function (test) {
      let positions = [{
        participant: `${hostname}/participants/participant1`,
        payments: '5',
        receipts: '0',
        net: '-5'
      },
        {
          participant: `${hostname}/participants/participant2`,
          payments: '0',
          receipts: '3',
          net: '3'
        },
        {
          participant: `${hostname}/participants/participant3`,
          payments: '0',
          receipts: '2',
          net: '2'
        }
      ]

      PositionService.calculateForAllParticipants.returns(P.resolve(positions))
      let expectedResponse = { positions: positions }

      let reply = {
        response: (output) => {
          test.ok(PositionService.calculateForAllParticipants.calledOnce)
          test.deepEqual(output, expectedResponse)
          test.end()
        }
      }
      await Handler.calculateForAllParticipants('', reply)
    })
    performTest.end()
  })

  handlerTest.test('calculateForParticipant should', (performTest) => {
    performTest.test('return positions if there are no settleable transfers or fee', async function (test) {
      PositionService.calculateForParticipant.returns(P.resolve({}))
      Participant.getByName.returns(P.resolve({ participantId: 11 }))

      let reply = {
        response: (output) => {
          test.ok(PositionService.calculateForParticipant.calledOnce)
          test.deepEqual(output, [])
          test.end()
        }
      }
      await Handler.calculateForParticipant({ params: { name: 'dfsp1' } }, reply)
    })

    performTest.test('return expected position if settleable transfers and fee exist', async function (test) {
      let positions = {
        participant: `${hostname}/participants/dfsp1`,
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

      PositionService.calculateForParticipant.returns(P.resolve(positions))
      Participant.getByName.returns(P.resolve({ participantId: 11 }))

      let reply = {
        response: (output) => {
          test.ok(PositionService.calculateForParticipant.calledOnce)
          test.deepEqual(output, positions)
          test.end()
        }
      }
      await Handler.calculateForParticipant({ params: { name: 'dfsp1' } }, reply)
    })
    performTest.end()
  })

  handlerTest.end()
})
