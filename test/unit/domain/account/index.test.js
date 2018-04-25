'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const Model = require('../../../../src/domain/participant/model')
const Crypto = require('../../../../src/lib/crypto')
const ValidationError = require('../../../../src/errors').ValidationError
const ParticipantService = require('../../../../src/domain/participant')

Test('Participant service', serviceTest => {
  let sandbox

  serviceTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Model)
    sandbox.stub(Crypto)
    test.end()
  })

  serviceTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  serviceTest.test('create should', createTest => {
    createTest.test('add username and hashed password to participant in model', test => {
      const name = 'dfsp1'
      const participantId = Uuid()
      const createdDate = new Date()
      const password = 'password'
      const hashedPassword = 'hashed password'
      const emailAddress = name + '@test.com'
      Model.create.returns(P.resolve({ name, participantId, createdDate, emailAddress }))
      Crypto.hash.withArgs(password).returns(P.resolve(hashedPassword))
      ParticipantService.create({ name, password, emailAddress })
        .then(participant => {
          test.equal(participant.participantId, participantId)
          test.equal(participant.name, name)
          test.equal(participant.createdDate, createdDate)
          const createArgs = Model.create.firstCall.args
          test.equal(createArgs[0].hashedPassword, hashedPassword)
          test.equal(participant.emailAddress, emailAddress)
          test.end()
        })
    })

    createTest.end()
  })

  serviceTest.test('createLedgerParticipant should', createLedgerParticipantTest => {
    createLedgerParticipantTest.test('check if a ledger participant exists and add it if it does not', test => {
      const name = 'LedgerName'
      const password = 'LedgerPassword'
      const participantId = Uuid()
      const createdDate = new Date()
      const hashedPassword = 'hashed password'
      const emailAddress = 'cc@test.com'
      Model.create.returns(P.resolve({ name, participantId, createdDate, emailAddress }))
      Model.getByName.returns(P.resolve(null))
      Crypto.hash.returns(P.resolve(hashedPassword))
      ParticipantService.createLedgerParticipant({ name, password, emailAddress })
        .then(participant => {
          test.equal(participant.participantId, participantId)
          test.equal(participant.name, name)
          test.equal(participant.createdDate, createdDate)
          const createArgs = Model.create.firstCall.args
          test.equal(createArgs[0].hashedPassword, hashedPassword)
          test.equal(participant.emailAddress, emailAddress)
          test.end()
        })
    })

    createLedgerParticipantTest.test('check if a ledger participant exists and return if it does', test => {
      const name = 'LedgerName'
      const password = 'LedgerPassword'
      const participantId = Uuid()
      const createdDate = new Date()
      const emailAddress = 'cc@test.com'
      Model.getByName.returns(P.resolve({ name, participantId, createdDate, emailAddress }))
      ParticipantService.createLedgerParticipant({ name, password, emailAddress })
        .then(participant => {
          test.equal(participant.participantId, participantId)
          test.equal(participant.name, name)
          test.equal(participant.createdDate, createdDate)
          test.equal(participant.emailAddress, emailAddress)
          test.end()
        })
    })

    createLedgerParticipantTest.end()
  })

  serviceTest.test('exists should', existsTest => {
    existsTest.test('reject if url is not parseable url', test => {
      ParticipantService.exists('not a url')
        .catch(ValidationError, e => {
          test.equal(e.message, 'Invalid participant URI: not a url')
          test.end()
        })
    })

    existsTest.test('reject if participant does not exist', test => {
      Model.getByName.returns(P.resolve(null))
      ParticipantService.exists('http://central-ledger/participants/dfsp1')
        .catch(ValidationError, e => {
          test.equal(e.message, 'Participant dfsp1 not found')
          test.end()
        })
    })

    existsTest.test('return error if exists', test => {
      const participant = { some_field: 1234 }
      Model.getByName.withArgs('dfsp2').returns(P.resolve(participant))
      ParticipantService.exists('http://central-ledger/participants/dfsp2')
        .then(result => {
          test.equal(result, participant)
          test.end()
        })
    })

    existsTest.end()
  })

  serviceTest.test('getAll should', getAllTest => {
    getAllTest.test('getAll from Model', test => {
      const all = []
      Model.getAll.returns(P.resolve(all))
      ParticipantService.getAll()
        .then(result => {
          test.equal(result, all)
          test.end()
        })
    })

    getAllTest.end()
  })

  serviceTest.test('getById should', getByIdTest => {
    getByIdTest.test('getById from Model', test => {
      const participant = {}
      const id = '12345'
      Model.getById.withArgs(id).returns(P.resolve(participant))
      ParticipantService.getById(id)
        .then(result => {
          test.equal(result, participant)
          test.end()
        })
    })

    getByIdTest.end()
  })

  serviceTest.test('getByName should', getByNameTest => {
    getByNameTest.test('getByName from Model', test => {
      const participant = {}
      const name = '12345'
      Model.getByName.withArgs(name).returns(P.resolve(participant))
      ParticipantService.getByName(name)
        .then(result => {
          test.equal(result, participant)
          test.end()
        })
    })

    getByNameTest.end()
  })

  serviceTest.test('updatePartyCredentials should', updatePartyCredentialsTest => {
    updatePartyCredentialsTest.test('updatePartyCredentials from Model', test => {
      const name = 'name'
      const password = '12345'
      Model.updatePartyCredentials.returns(P.resolve({ name }))
      Crypto.hash.withArgs(password).returns(P.resolve('123456'))

      ParticipantService.updatePartyCredentials({ name }, { password })
        .then(result => {
          test.deepEqual(result, { name })
          test.end()
        })
    })

    updatePartyCredentialsTest.end()
  })

  serviceTest.test('updateParticipantSettlement should', updateParticipantSettlementTest => {
    updateParticipantSettlementTest.test('updateParticipantSettlement from Model', test => {
      const participantId = '1'
      const participantNumber = '12345'
      const routingNumber = '67890'
      const response = { participantId, participantNumber, routingNumber }
      Model.updateParticipantSettlement.returns(P.resolve(response))

      ParticipantService.updateParticipantSettlement({ participantId }, { participantNumber, routingNumber })
        .then(result => {
          test.deepEqual(result, response)
          test.end()
        })
    })

    updateParticipantSettlementTest.end()
  })

  serviceTest.test('update should', updateTest => {
    updateTest.test('update from Model', test => {
      const isDisabled = false
      const name = '12345'
      const id = 1
      const participant = {
        participantId: id,
        isDisabled: true
      }
      const updatedParticipant = {
        participantId: id,
        isDisabled: isDisabled
      }
      const payload = {
        name: name,
        is_disabled: isDisabled
      }
      Model.getByName.withArgs(name).returns(P.resolve(participant))
      Model.update.withArgs(participant, isDisabled).returns(P.resolve(updatedParticipant))
      ParticipantService.update(name, payload)
        .then(result => {
          test.equal(result.participantId, participant.participantId)
          test.equal(result.isDisabled, isDisabled)
          test.end()
        })
    })

    updateTest.end()
  })

  serviceTest.test('verify should', verifyTest => {
    verifyTest.test('return false if participant not found', test => {
      Model.getByName.returns(P.resolve(null))
      ParticipantService.verify('name', 'password')
        .catch(result => {
          test.equal(result.message, 'Participant does not exist')
          test.end()
        })
    })

    verifyTest.test('return error if passwords do not match', test => {
      const participantId = '1234'
      const name = 'name'
      const password = 'password'
      const participant = { name, participantId }
      const userCredentials = { participantId, password }
      Model.getByName.withArgs(name).returns(P.resolve(participant))
      Model.retrievePartyCredentials.returns(P.resolve(userCredentials))
      Crypto.verifyHash.withArgs(password, userCredentials.password).returns(P.resolve(false))

      ParticipantService.verify(name, password)
        .catch(result => {
          test.equal(result.message, 'Partyname and password are invalid')
          test.end()
        })
    })

    verifyTest.test('return participant if passwords match', test => {
      const participantId = '1234'
      const name = 'name'
      const password = 'password'
      const participant = { name, participantId }
      const userCredentials = { participantId, password }
      Model.getByName.withArgs(name).returns(P.resolve(participant))
      Model.retrievePartyCredentials.returns(P.resolve(userCredentials))
      Crypto.verifyHash.withArgs(password, userCredentials.password).returns(P.resolve(true))

      ParticipantService.verify(name, password)
        .then(result => {
          test.equal(result, participant)
          test.end()
        })
    })

    verifyTest.end()
  })

  serviceTest.end()
})
