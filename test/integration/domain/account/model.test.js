'use strict'

const Test = require('tape')
const Fixtures = require('../../../fixtures')
const Db = require('../../../../src/db')
const Model = require('../../../../src/domain/participant/model')

function createParticipant (name, hashedPassword = 'password', emailAddress = name + '@test.com') {
  const payload = { name, hashedPassword, emailAddress }
  return Model.create(payload)
}

function deleteParticipants () {
  return Db.from('participant').destroy()
}

Test('participant model', modelTest => {
  modelTest.test('create should', createTest => {
    createTest.test('create a new participant', test => {
      const participantName = Fixtures.generateParticipantName()
      const hashedPassword = 'some-password'
      const emailAddress = participantName + '@test.com'
      createParticipant(participantName, hashedPassword, emailAddress)
        .then((participant) => {
          test.equal(participant.name, participantName)
          test.ok(participant.createdDate)
          test.ok(participant.participantId)
          test.ok(participant.emailAddress)
          test.equal(participant.isDisabled, false)
          test.ok
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('getByName should', getByNameTest => {
    getByNameTest.test('get participant by name', test => {
      const participantName = Fixtures.generateParticipantName()
      createParticipant(participantName)
        .then((participant) => {
          Model.getByName(participant.name)
            .then((found) => {
              test.notEqual(found, participant)
              test.equal(found.name, participant.name)
              test.deepEqual(found.createdDate, participant.createdDate)
              test.equal(found.emailAddress, participant.emailAddress)
              test.equal(found.isDisabled, false)
              test.end()
            })
        })
    })

    getByNameTest.end()
  })

  modelTest.test('getById should', getByIdTest => {
    getByIdTest.test('get participant by id', test => {
      const participantName = Fixtures.generateParticipantName()
      createParticipant(participantName)
        .then((participant) => {
          Model.getById(participant.participantId)
            .then((found) => {
              test.notEqual(found, participant)
              test.equal(found.participantId, participant.participantId)
              test.deepEqual(found.createdDate, participant.createdDate)
              test.equal(found.isDisabled, false)
              test.end()
            })
        })
    })

    getByIdTest.end()
  })

  modelTest.test('getAll should', getAllTest => {
    getAllTest.test('return all participant and order by name ascending', test => {
      const participant1Name = 'zzz' + Fixtures.generateParticipantName()
      const participant2Name = 'aaa' + Fixtures.generateParticipantName()

      deleteParticipants()
        .then(() => createParticipant(participant1Name))
        .then(() => createParticipant(participant2Name))
        .then(() => Model.getAll())
        .then(participant => {
          test.equal(participant.length, 2)
          test.equal(participant[0].name, participant2Name)
          test.equal(participant[1].name, participant1Name)
          test.end()
        })
    })

    getAllTest.end()
  })

  modelTest.test('update should', updateTest => {
    updateTest.test('update participant isDisabled field', test => {
      const participantName = Fixtures.generateParticipantName()
      const isDisabled = true
      createParticipant(participantName)
        .then((participant) => {
          Model.update(participant, isDisabled)
            .then((updated) => {
              test.notEqual(updated, participant)
              test.equal(updated.name, participant.name)
              test.deepEqual(updated.createdDate, participant.createdDate)
              test.equal(updated.isDisabled, isDisabled)
              test.end()
            })
        })
    })

    updateTest.end()
  })

  modelTest.test('updatePartyCredentials should', updatePartyCredentialsTest => {
    updatePartyCredentialsTest.test('update party credentials for a given participant', test => {
      const participant = Fixtures.generateParticipantName()
      const password = 'password'
      const updatedPassword = 'password2'
      createParticipant(participant, password)
        .then((createdParticipant) => Model.updatePartyCredentials(createdParticipant, updatedPassword)
          .then((userCredentials) => {
            test.equal(userCredentials.participantId, createdParticipant.participantId)
            test.equal(userCredentials.password, updatedPassword)
            test.end()
          }))
    })

    updatePartyCredentialsTest.end()
  })

  modelTest.test('retrievePartyCredentials should', retrievePartyCredentialsTest => {
    retrievePartyCredentialsTest.test('return party credentials for a given participant', test => {
      const participant = Fixtures.generateParticipantName()
      const password = 'password'
      createParticipant(participant, password)
        .then((createdParticipant) => Model.retrievePartyCredentials(createdParticipant)
          .then((userCredentials) => {
            test.equal(userCredentials.participantId, createdParticipant.participantId)
            test.equal(userCredentials.password, password)
            test.end()
          }))
    })

    retrievePartyCredentialsTest.end()
  })

  modelTest.test('updateParticipantSettlement should', updateParticipantSettlementTest => {
    updateParticipantSettlementTest.test('update settlement for a given participant', test => {
      const participant = Fixtures.generateParticipantName()
      const settlement = {
        participant_number: '12345',
        routing_number: '67890'
      }
      createParticipant(participant, '1234')
        .then((createdParticipant) => Model.updateParticipantSettlement(createdParticipant, settlement)
          .then((participantSettlement) => {
            test.equal(participantSettlement.participantName, participant)
            test.equal(participantSettlement.participantNumber, settlement.participant_number)
            test.equal(participantSettlement.routingNumber, settlement.routing_number)
            test.end()
          }))
    })

    updateParticipantSettlementTest.end()
  })

  modelTest.end()
})
