'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')
const Config = require('../../../../src/lib/config')

Test('post and get an participant', assert => {
  const participantName = Fixtures.generateParticipantName()
  const password = '1234'

  Base.createParticipant(participantName, password)
    .expect(201)
    .expect('Content-Type', /json/)
    .then(res => {
      let expectedCreated = res.body.created
      assert.notEqual(expectedCreated, undefined)
      assert.equal(res.body.name, participantName)

      Base.getParticipant(participantName)
        .expect(200)
        .expect('Content-Type', /json/)
        .then(getRes => {
          assert.equal(participantName, getRes.body.name)
          assert.equal(expectedCreated, getRes.body.created)
          assert.equal('0', getRes.body.balance)
          assert.equal(false, getRes.body.is_disabled)
          assert.equal('http://central-ledger', getRes.body.ledger)
          assert.end()
        })
    })
})

Test('return the net position for the participant as the balance', async function (assert) {
  let fulfilment = 'oAKAAA'
  Config.LEDGER_ACCOUNT_NAME = 'LedgerParticipantName'
  let transferId = Fixtures.generateTransferId()
  let transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, '50'), Fixtures.buildDebitOrCredit(Base.participant2Name, '50'))

  let transfer2Id = Fixtures.generateTransferId()
  let transfer2 = Fixtures.buildTransfer(transfer2Id, Fixtures.buildDebitOrCredit(Base.participant2Name, '15'), Fixtures.buildDebitOrCredit(Base.participant1Name, '15'))

  await Base.prepareTransfer(transferId, transfer)
  await Base.fulfillTransfer(transferId, fulfilment)
  await Base.prepareTransfer(transfer2Id, transfer2)
  await Base.fulfillTransfer(transfer2Id, fulfilment)
  const res = await Base.getParticipant(Base.participant1Name)
  assert.equal(Base.participant1Name, res.body.name)
  assert.equal('-35', res.body.balance)
  assert.end()
})

Test('ensure an participant name can only be registered once', assert => {
  const participantName = Fixtures.generateParticipantName()
  const password = '1234'

  Base.createParticipant(participantName, password)
    .expect(201)
    .expect('Content-Type', /json/)
    .then(() => {
      Base.createParticipant(participantName, password)
        .expect(422)
        .expect('Content-Type', /json/)
        .then(res => {
          assert.equal(res.body.id, 'RecordExistsError')
          assert.equal(res.body.message, 'The participant has already been registered')
          assert.end()
        })
    })
})

Test('update an participants password', async function (test) {
  const participantName = Fixtures.generateParticipantName()
  const password = '1234'

  await Base.createParticipant(participantName, password)
  const res = await Base.putApi(`/participants/${participantName}`, {password, emailAddress: participantName + '@test.com'})
  test.equal(res.body.id, `http://central-ledger/participants/${participantName}`)
  test.equal(res.body.name, participantName)
  test.equal(res.body.ledger, 'http://central-ledger')
  test.end()
})

Test('update an participants settlement', test => {
  const participantName = Fixtures.generateParticipantName()
  const password = '1234'
  const participantNumber = '1234'
  const routingNumber = '5678'

  Base.createParticipant(participantName, password)
    .expect(201)
    .expect('Content-Type', /json/)
    .then(() => {
      Base.putApi(`/participants/${participantName}/settlement`, {participant_number: participantNumber, routing_number: routingNumber})
        .expect(200)
        .expect('Content-Type', /json/)
        .then(res => {
          test.ok(res.body.participant_id)
          test.equal(res.body.participant_number, participantNumber)
          test.equal(res.body.routing_number, routingNumber)
          test.end()
        })
    })
})
