'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Model = require(`${src}/domain/participant/model`)
const Db = require(`${src}/db`)

Test('participant model', modelTest => {
  let sandbox

  modelTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()

    Db.participant = {
      insert: sandbox.stub(),
      update: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub()
    }
    Db.userCredentials = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
      update: sandbox.stub()
    }
    Db.participantSettlement = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
      update: sandbox.stub()
    }

    t.end()
  })

  modelTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  modelTest.test('getAll should', getAllTest => {
    getAllTest.test('return exception if db query throws', test => {
      const error = new Error()

      Db.participant.find.returns(P.reject(error))

      Model.getAll()
        .then(() => {
          test.fail('Should have thrown error')
        })
        .catch(err => {
          test.equal(err, error)
          test.end()
        })
    })

    getAllTest.test('return all participant ordered by name', test => {
      const participant1Name = 'dfsp1'
      const participant2Name = 'dfsp2'
      const participant = [{ name: participant1Name }, { name: participant2Name }]

      Db.participant.find.returns(P.resolve(participant))

      Model.getAll()
        .then((found) => {
          test.equal(found, participant)
          test.ok(Db.participant.find.calledWith({}, { order: 'name asc' }))
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    getAllTest.end()
  })

  modelTest.test('getById should', getByIdTest => {
    getByIdTest.test('return exception if db query throws', test => {
      const error = new Error()

      Db.participant.findOne.returns(P.reject(error))

      Model.getById(1)
        .then(() => {
          test.fail('Should have thrown error')
        })
        .catch(err => {
          test.equal(err, error)
          test.end()
        })
    })

    getByIdTest.test('finds participant by id', test => {
      const id = 1
      const participant = { participantId: id }

      Db.participant.findOne.returns(P.resolve(participant))

      Model.getById(id)
        .then(r => {
          test.equal(r, participant)
          test.ok(Db.participant.findOne.calledWith({ participantId: id }))
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    getByIdTest.end()
  })

  modelTest.test('getByName should', getByNameTest => {
    getByNameTest.test('return exception if db query throws', test => {
      let name = 'dfsp1'
      let error = new Error()

      Db.participant.findOne.returns(P.reject(error))

      Model.getByName(name)
        .then(() => {
          test.fail('Should have thrown error')
        })
        .catch(err => {
          test.equal(err, error)
          test.end()
        })
    })

    getByNameTest.test('finds participant by name', test => {
      let name = 'dfsp1'
      let participant = { name: name }

      Db.participant.findOne.returns(P.resolve(participant))

      Model.getByName(name)
        .then(r => {
          test.equal(r, participant)
          test.ok(Db.participant.findOne.calledWith({ name }))
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    getByNameTest.end()
  })

  modelTest.test('update should', updateTest => {
    updateTest.test('return exception if db query throws', test => {
      let error = new Error()
      const id = 1
      const participant = { participantId: id }
      const isDisabled = false

      Db.participant.update.returns(P.reject(error))

      Model.update(participant, isDisabled)
        .then(() => {
          test.fail('Should have thrown error')
        })
        .catch(err => {
          test.ok(Db.participant.update.withArgs({ participantId: id }, { isDisabled }).calledOnce)
          test.equal(err, error)
          test.end()
        })
    })

    updateTest.test('update an participant', test => {
      let name = 'dfsp1'
      const isDisabled = true
      const id = 1

      let participant = {
        participantId: id,
        name: name,
        isDisabled: false
      }

      let updatedParticipant = {
        participantId: id,
        name: name,
        isDisabled: isDisabled
      }

      Db.participant.update.returns(P.resolve(updatedParticipant))

      Model.update(participant, isDisabled)
        .then(r => {
          test.ok(Db.participant.update.withArgs({ participantId: id }, { isDisabled }).calledOnce)
          test.equal(r, updatedParticipant)
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    updateTest.end()
  })

  modelTest.test('create should', createTest => {
    createTest.test('save payload and return new participant', test => {
      let name = 'dfsp1'
      let emailAddress = 'dfsp1@test.com'
      let payload = { name: name, hashedPassword: 'hashedPassword', emailAddress: emailAddress }
      let insertedParticipant = { participantId: 1, name: name, emailAddress: emailAddress }
      let participantId = 1

      Db.participant.insert.returns(P.resolve(participantId))
      Db.participant.findOne.returns(P.resolve(insertedParticipant))
      Db.userCredentials.insert.returns(P.resolve({}))

      Model.create(payload)
        .then(s => {
          test.ok(Db.participant.insert.withArgs({ name: name, emailAddress: payload.emailAddress }).calledOnce)
          test.ok(Db.participant.findOne.withArgs({ participantId: participantId }).calledOnce)
          test.ok(Db.userCredentials.insert.withArgs({ participantId: participantId, password: payload.hashedPassword }).calledOnce)
          test.equal(s, insertedParticipant)
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('updatePartyCredentials should', updatePartyCredentialsTest => {
    updatePartyCredentialsTest.test('return party credentials for a given participant', test => {
      let participant = { name: 'dfsp1', participantId: '1234' }
      let password = '1234'
      let userCredentials = { participantId: participant.participantId, password }

      Db.userCredentials.update.returns(P.resolve(userCredentials))

      Model.updatePartyCredentials(participant, password)
        .then(r => {
          test.ok(Db.userCredentials.update.withArgs({ participantId: participant.participantId }, { password }).calledOnce)
          test.equal(r, userCredentials)
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    updatePartyCredentialsTest.end()
  })

  modelTest.test('retrievePartyCredentials should', retrieverPartyCredsTest => {
    retrieverPartyCredsTest.test('return party credentials for a given participant', test => {
      let participant = { name: 'dfsp1', participantId: '1234' }
      let userCredentials = { participantId: participant.participantId, password: 'password' }

      Db.userCredentials.findOne.returns(P.resolve(userCredentials))

      Model.retrievePartyCredentials(participant)
        .then(r => {
          test.equal(r.participantId, userCredentials.participantId)
          test.equal(r.password, userCredentials.password)
          test.ok(Db.userCredentials.findOne.calledWith({ participantId: participant.participantId }))
          test.end()
        })
    })

    retrieverPartyCredsTest.end()
  })

  modelTest.test('updateParticipantSettlement should', updateParticipantSettlementTest => {
    updateParticipantSettlementTest.test('return created settlement for a given participant', test => {
      let participantId = '1234'
      let participantNumber = '12345'
      let routingNumber = '67890'
      let name = 'name'

      Db.participantSettlement.findOne.returns(P.resolve(null))
      Db.participantSettlement.insert.returns(P.resolve({ participantId, participantNumber, routingNumber }))

      Model.updateParticipantSettlement({ participantId, name }, { participant_number: participantNumber, routing_number: routingNumber })
        .then(r => {
          test.ok(Db.participantSettlement.insert.withArgs({ participantId, participantNumber, routingNumber }).calledOnce)
          test.deepEqual(r, { participantName: name, participantNumber, routingNumber })
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    updateParticipantSettlementTest.test('return updated settlement for a given participant', test => {
      let participantId = '1234'
      let participantNumber = '12345'
      let routingNumber = '67890'
      let name = 'name'

      Db.participantSettlement.findOne.returns(P.resolve({ participantId, participantNumber, routingNumber }))
      Db.participantSettlement.update.returns(P.resolve({ participantId, participantNumber, routingNumber }))

      Model.updateParticipantSettlement({ participantId, name }, { participant_number: participantNumber, routing_number: routingNumber })
        .then(r => {
          test.ok(Db.participantSettlement.update.withArgs({ participantId }, { participantNumber, routingNumber }).calledOnce)
          test.deepEqual(r, { participantName: name, participantNumber, routingNumber })
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    updateParticipantSettlementTest.end()
  })

  modelTest.end()
})
