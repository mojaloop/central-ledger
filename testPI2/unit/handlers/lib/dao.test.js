'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const Participants = require('../../../../src/domain/participant')
const DAO = require('../../../../src/handlers/lib/dao')

const participantsList = [
  {
    participantId: 1,
    currencyId: 'USD',
    name: 'fsp1',
    createdDate: new Date(),
    isDisabled: false
  },
  {
    participantId: 2,
    currencyId: 'USD',
    name: 'fsp2',
    createdDate: new Date(),
    isDisabled: false
  }
]

Test('DAO', daoTest => {
  let sandbox

  daoTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Participants)
    test.end()
  })

  daoTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  daoTest.test('dao should', retrieveAllParticipantsTest => {
    retrieveAllParticipantsTest.test('return a map of participants', async (test) => {
      Participants.getAll.returns(P.resolve(participantsList))
      const participants = await DAO.retrieveAllParticipants()
      test.deepEqual(participants, ['fsp1', 'fsp2'])
      test.end()
    })

    retrieveAllParticipantsTest.test('return a map of participants', async (test) => {
      try {
        Participants.getAll.throws(new Error())
        await DAO.retrieveAllParticipants()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    retrieveAllParticipantsTest.end()
  })

  daoTest.end()
})
